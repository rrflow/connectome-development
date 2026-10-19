//! An explicitly configured SSH carriage for an existing RRD HTTP origin.
//! This owns only a local forwarding process. It never starts an engine,
//! installs an estate, changes the saved port, or handles an RRD credential.

use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::net::{Ipv4Addr, SocketAddr};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::sync::Mutex as AsyncMutex;
use tokio::time::{sleep, timeout};

use super::transport::rrd_origin;

const FORWARD_TIMEOUT: Duration = Duration::from_secs(12);
const CONNECT_PROBE_TIMEOUT: Duration = Duration::from_millis(200);
const DIAGNOSTIC_LINES: usize = 32;

#[derive(Debug, Clone, PartialEq, Eq)]
struct ForwardTarget {
    host: String,
    endpoint: String,
    address: SocketAddr,
}

impl ForwardTarget {
    fn parse(endpoint: &str, host: &str) -> Result<Self, String> {
        validate_host(host)?;
        let origin = rrd_origin(endpoint)?;
        if origin.scheme() != "http" || origin.host_str() != Some("127.0.0.1") {
            return Err("SSH forwarding requires the saved HTTP origin on 127.0.0.1".into());
        }
        let port = origin
            .port_or_known_default()
            .filter(|port| *port != 0)
            .ok_or("SSH forwarding requires the saved nonzero loopback port")?;
        Ok(Self {
            host: host.to_owned(),
            endpoint: origin.origin().ascii_serialization(),
            address: SocketAddr::from((Ipv4Addr::LOCALHOST, port)),
        })
    }

    fn arguments(&self) -> Vec<String> {
        vec![
            "-N".into(),
            "-T".into(),
            "-o".into(),
            "BatchMode=yes".into(),
            "-o".into(),
            "ExitOnForwardFailure=yes".into(),
            "-o".into(),
            "StrictHostKeyChecking=yes".into(),
            "-o".into(),
            "ConnectTimeout=10".into(),
            "-o".into(),
            "ServerAliveInterval=15".into(),
            "-o".into(),
            "ServerAliveCountMax=2".into(),
            "-L".into(),
            format!(
                "127.0.0.1:{}:127.0.0.1:{}",
                self.address.port(),
                self.address.port()
            ),
            self.host.clone(),
        ]
    }
}

fn validate_host(host: &str) -> Result<(), String> {
    let parts: Vec<_> = host.split('@').collect();
    if host.is_empty()
        || host.len() > 255
        || parts.len() > 2
        || parts.iter().any(|part| {
            part.is_empty()
                || part.starts_with('-')
                || !part
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
        })
    {
        return Err("SSH host must be a configured host alias or user@host, without options, whitespace, or shell text".into());
    }
    Ok(())
}

struct SshForward {
    target: ForwardTarget,
    child: Child,
    diagnostics: Arc<Mutex<VecDeque<String>>>,
    reader: Option<JoinHandle<()>>,
}

impl SshForward {
    fn start(target: ForwardTarget) -> Result<Self, String> {
        let mut command = Command::new("ssh");
        command
            .args(target.arguments())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command
            .spawn()
            .map_err(|error| format!("cannot start configured SSH forwarding: {error}"))?;
        let stderr = child.stderr.take().expect("piped SSH stderr");
        let diagnostics = Arc::new(Mutex::new(VecDeque::new()));
        let output = Arc::clone(&diagnostics);
        let reader = std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                let mut lines = output.lock().unwrap_or_else(|error| error.into_inner());
                if lines.len() == DIAGNOSTIC_LINES {
                    lines.pop_front();
                }
                lines.push_back(line.chars().take(2048).collect());
            }
        });
        Ok(Self {
            target,
            child,
            diagnostics,
            reader: Some(reader),
        })
    }

    fn is_live(&mut self) -> Result<bool, String> {
        self.child
            .try_wait()
            .map(|status| status.is_none())
            .map_err(|error| format!("cannot inspect the configured SSH forward: {error}"))
    }

    fn diagnostic(&mut self) -> String {
        // Give the stderr reader a bounded chance to drain after process exit.
        // A user-configured SSH proxy can retain its pipe, so never join a
        // blocked reader indefinitely during a failed connection or app exit.
        let deadline = Instant::now() + Duration::from_millis(100);
        while self
            .reader
            .as_ref()
            .is_some_and(|reader| !reader.is_finished())
            && Instant::now() < deadline
        {
            std::thread::sleep(Duration::from_millis(5));
        }
        if let Some(reader) = self.reader.take() {
            if reader.is_finished() {
                let _ = reader.join();
            }
        }
        self.diagnostics
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
            .cloned()
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn stop(&mut self) -> Result<(), String> {
        if self.is_live()? {
            self.child
                .kill()
                .map_err(|error| format!("cannot stop the owned SSH forward: {error}"))?;
        }
        self.child
            .wait()
            .map_err(|error| format!("cannot reap the owned SSH forward: {error}"))?;
        let _ = self.diagnostic();
        Ok(())
    }

    async fn wait_for_listener(&mut self) -> Result<(), String> {
        let deadline = Instant::now() + FORWARD_TIMEOUT;
        loop {
            if !self.is_live()? {
                let detail = self.diagnostic();
                return Err(format!(
                    "configured SSH forwarding exited before opening {}: {}",
                    self.target.address,
                    if detail.is_empty() {
                        "no SSH diagnostic was returned"
                    } else {
                        &detail
                    }
                ));
            }
            if matches!(
                timeout(
                    CONNECT_PROBE_TIMEOUT,
                    TcpStream::connect(self.target.address)
                )
                .await,
                Ok(Ok(_))
            ) {
                // ExitOnForwardFailure must still have a live process when its
                // listener is reachable. The RRD handshake remains the remote
                // protocol/instance check after this transport-only probe.
                sleep(Duration::from_millis(100)).await;
                if self.is_live()? {
                    return Ok(());
                }
                continue;
            }
            if Instant::now() >= deadline {
                self.stop()?;
                let detail = self.diagnostic();
                return Err(format!(
                    "configured SSH forwarding did not open {} within {} seconds{}",
                    self.target.address,
                    FORWARD_TIMEOUT.as_secs(),
                    if detail.is_empty() {
                        String::new()
                    } else {
                        format!(": {detail}")
                    }
                ));
            }
            sleep(Duration::from_millis(50)).await;
        }
    }
}

impl Drop for SshForward {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

/// One explicit host/origin forwarding process owned by the application.
#[derive(Default)]
pub struct SshForwardState(AsyncMutex<Option<SshForward>>);

impl SshForwardState {
    pub async fn prepare(&self, endpoint: &str, host: Option<&str>) -> Result<(), String> {
        let origin = rrd_origin(endpoint)?.origin().ascii_serialization();
        // Validate explicit input before acquiring or changing process state.
        let target = host
            .map(|host| ForwardTarget::parse(endpoint, host))
            .transpose()?;
        let mut guard = self.0.lock().await;
        if let Some(current) = guard.as_mut() {
            if !current.is_live()? {
                guard.take();
            }
        }
        match target {
            None => {
                if guard
                    .as_ref()
                    .is_some_and(|current| current.target.endpoint == origin)
                {
                    return Err("this loopback origin is owned by an SSH forward; use its configured saved profile or disconnect it explicitly".into());
                }
                Ok(())
            }
            Some(target) => {
                if let Some(current) = guard.as_mut() {
                    if current.target != target {
                        return Err("a different SSH host or origin is already forwarded; disconnect that native runtime before switching profiles".into());
                    }
                    return Ok(());
                }
                // Never mistake an unrelated listener (or an old manual
                // tunnel) for a forward owned by this application.
                if matches!(
                    timeout(CONNECT_PROBE_TIMEOUT, TcpStream::connect(target.address)).await,
                    Ok(Ok(_))
                ) {
                    return Err(format!("{} is already listening outside this application's SSH ownership; no SSH process was started", target.address));
                }
                let mut forward = SshForward::start(target)?;
                forward.wait_for_listener().await?;
                *guard = Some(forward);
                Ok(())
            }
        }
    }

    pub async fn stop_endpoint(&self, endpoint: &str) -> Result<(), String> {
        let origin = rrd_origin(endpoint)?.origin().ascii_serialization();
        let mut guard = self.0.lock().await;
        if let Some(forward) = guard
            .as_mut()
            .filter(|forward| forward.target.endpoint == origin)
        {
            forward.stop()?;
            guard.take();
        }
        Ok(())
    }

    pub async fn stop_all(&self) -> Result<(), String> {
        let mut guard = self.0.lock().await;
        if let Some(forward) = guard.as_mut() {
            forward.stop()?;
            guard.take();
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_explicit_host_aliases_and_exact_saved_loopback_ports_are_accepted() {
        let target = ForwardTarget::parse("http://127.0.0.1:9477/", "devstation").unwrap();
        assert_eq!(target.endpoint, "http://127.0.0.1:9477");
        assert_eq!(target.address.port(), 9477);
        assert!(validate_host("operator@dev-station.example").is_ok());
        for host in [
            "",
            "-oProxyCommand=x",
            "devstation -v",
            "user@@host",
            "host;whoami",
            "host\nnext",
            "@host",
        ] {
            assert!(validate_host(host).is_err(), "invalid host: {host:?}");
        }
        for endpoint in [
            "http://127.0.0.1:0",
            "http://localhost:9477",
            "https://127.0.0.1:9477",
            "http://remote:9477",
            "http://127.0.0.1:9477/path",
        ] {
            assert!(
                ForwardTarget::parse(endpoint, "devstation").is_err(),
                "invalid origin: {endpoint}"
            );
        }
    }

    #[test]
    fn ssh_arguments_are_noninteractive_owned_forwarding_without_an_engine_command() {
        let args = ForwardTarget::parse("http://127.0.0.1:9477", "devstation")
            .unwrap()
            .arguments();
        assert!(args.contains(&"BatchMode=yes".into()));
        assert!(args.contains(&"ExitOnForwardFailure=yes".into()));
        assert!(args.contains(&"StrictHostKeyChecking=yes".into()));
        assert!(args.contains(&"ServerAliveInterval=15".into()));
        assert!(args.contains(&"127.0.0.1:9477:127.0.0.1:9477".into()));
        assert_eq!(args.last().unwrap(), "devstation");
        assert!(args.contains(&"-N".into()));
        assert!(!args
            .iter()
            .any(|arg| arg.contains("rrflow") || arg == "serve" || arg == "install"));
    }

    #[test]
    fn unconfigured_transport_does_not_start_ssh_and_busy_ports_are_not_claimed() {
        tauri::async_runtime::block_on(async {
            let state = SshForwardState::default();
            state.prepare("http://127.0.0.1:9477", None).await.unwrap();
            assert!(state.0.lock().await.is_none());
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let endpoint = format!("http://{}", listener.local_addr().unwrap());
            let error = state
                .prepare(&endpoint, Some("must-not-be-invoked"))
                .await
                .unwrap_err();
            assert!(error.contains("already listening outside"));
            assert!(state.0.lock().await.is_none());
        });
    }

    #[test]
    fn malformed_ssh_input_cannot_touch_forwarding_state() {
        tauri::async_runtime::block_on(async {
            let state = SshForwardState::default();
            assert!(state
                .prepare("http://127.0.0.1:9477", Some("-V"))
                .await
                .is_err());
            assert!(state.0.lock().await.is_none());
            state.stop_all().await.unwrap();
        });
    }

    fn disposable_owned_process() -> SshForward {
        #[cfg(windows)]
        let mut command = {
            use std::os::windows::process::CommandExt;
            let mut command = Command::new("powershell.exe");
            command
                .args([
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "Start-Sleep -Seconds 60",
                ])
                .creation_flags(0x08000000);
            command
        };
        #[cfg(not(windows))]
        let mut command = {
            let mut command = Command::new("sleep");
            command.arg("60");
            command
        };
        let child = command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("start a disposable process for ownership tests");
        SshForward {
            target: ForwardTarget::parse("http://127.0.0.1:9477", "devstation").unwrap(),
            child,
            diagnostics: Arc::new(Mutex::new(VecDeque::new())),
            reader: None,
        }
    }

    #[test]
    fn only_the_matching_owned_forward_is_stopped_and_dead_handles_are_removed() {
        tauri::async_runtime::block_on(async {
            let mut process = disposable_owned_process();
            assert!(process.is_live().unwrap());
            process.stop().unwrap();
            assert!(!process.is_live().unwrap());
            let state = SshForwardState(AsyncMutex::new(Some(process)));
            state.prepare("http://127.0.0.1:9477", None).await.unwrap();
            assert!(
                state.0.lock().await.is_none(),
                "exited processes cannot be reused"
            );

            let process = disposable_owned_process();
            let state = SshForwardState(AsyncMutex::new(Some(process)));
            state.stop_endpoint("http://127.0.0.1:9478").await.unwrap();
            assert!(state.0.lock().await.as_mut().unwrap().is_live().unwrap());
            assert!(
                state.prepare("http://127.0.0.1:9477", None).await.is_err(),
                "an unconfigured profile cannot silently borrow the remote forward"
            );
            assert!(state
                .prepare("http://127.0.0.1:9477", Some("another-host"))
                .await
                .is_err());
            state.stop_endpoint("http://127.0.0.1:9477/").await.unwrap();
            assert!(state.0.lock().await.is_none());
        });
    }
}
