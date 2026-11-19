//! What the engine says about itself on its own output: the address and
//! instance it announces, and the diagnostic it writes when a command fails.
//!
//! Both behaviours come from the native-client branch (pull request 10), whose
//! tests are carried here. `main` had accepted any address that began with
//! `http://127.0.0.1:` and had kept only the last line of a failure.

use super::*;

/// The loopback origin and instance a served engine announced.
///
/// The address must be a canonical origin on `127.0.0.1` with a real port: no
/// path, query, fragment or user part, so nothing announced can point the
/// client at another host while looking local.
pub(super) fn announced_identity(announced: &Value) -> Result<(String, String), RrdError> {
    if announced["status"] != "listening" {
        return Err("the engine's announcement does not report listening".into());
    }
    let endpoint = announced["url"]
        .as_str()
        .ok_or("the engine's announcement does not name its HTTP address")?;
    let origin = rrd_origin(endpoint)?;
    if origin.scheme() != "http"
        || origin.host_str() != Some("127.0.0.1")
        || origin.port_or_known_default() == Some(0)
    {
        return Err(
            "the engine's announcement must name a loopback HTTP origin on 127.0.0.1".into(),
        );
    }
    let instance = announced["instance_id"]
        .as_str()
        .ok_or("the engine's announcement does not name its instance")?;
    rrd_contract::CanonicalId::new(instance)
        .map_err(|error| format!("the engine's announcement has an invalid instance: {error}"))?;
    Ok((origin.origin().ascii_serialization(), instance.to_owned()))
}

/// Everything a failed engine command wrote to its error output. The engine's
/// last line names the failure and the lines before it often say why, so none
/// is dropped.
pub(super) fn diagnostic(stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    let text = text.trim();
    if text.is_empty() {
        "no error output".to_owned()
    } else {
        text.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn announcement_requires_a_canonical_loopback_origin_and_instance() {
        let announcement = |url: &str| json!({ "status": "listening", "url": url, "instance_id": "test-instance" });
        let (origin, instance) =
            announced_identity(&announcement("http://127.0.0.1:9477/")).unwrap();
        assert_eq!(origin, "http://127.0.0.1:9477");
        assert_eq!(instance, "test-instance");
        for invalid in [
            "http://127.0.0.1:0",
            "http://127.0.0.1:9477/path",
            "http://127.0.0.1:9477?token=x",
            "http://127.0.0.1:9477#fragment",
            "http://127.0.0.1:9477@evil.example",
            "https://127.0.0.1:9477",
            "http://localhost:9477",
        ] {
            assert!(
                announced_identity(&announcement(invalid)).is_err(),
                "invalid origin: {invalid}"
            );
        }
        assert!(announced_identity(
            &json!({ "status": "listening", "url": "http://127.0.0.1:9477", "instance_id": "" })
        )
        .is_err());
        assert!(announced_identity(&json!({
            "status": "ready",
            "url": "http://127.0.0.1:9477",
            "instance_id": "test-instance"
        }))
        .is_err());
    }

    #[test]
    fn command_failures_keep_the_native_diagnostic_in_full() {
        #[cfg(windows)]
        let (executable, arguments) = (
            Path::new("powershell.exe"),
            vec![
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "[Console]::Error.WriteLine('authentication diagnostic'); [Console]::Error.WriteLine('error: RRD API 401 Unauthorized: operator credential rejected'); exit 23",
            ],
        );
        #[cfg(not(windows))]
        let (executable, arguments) = (
            Path::new("sh"),
            vec![
                "-c",
                "printf 'authentication diagnostic\\nerror: RRD API 401 Unauthorized: operator credential rejected\\n' >&2; exit 23",
            ],
        );
        let arguments: Vec<&std::ffi::OsStr> = arguments.iter().map(std::ffi::OsStr::new).collect();
        let error = run(executable, &arguments).unwrap_err();
        let message = error.to_string();
        assert!(message.contains("authentication diagnostic"), "{message}");
        assert!(
            message.contains("RRD API 401 Unauthorized: operator credential rejected"),
            "{message}"
        );
    }

    /// A process that prints one line that is not an announcement and waits.
    fn waiting_child() -> Child {
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
                    "[Console]::Out.WriteLine('invalid announcement'); [Console]::Out.Flush(); Start-Sleep -Seconds 60",
                ])
                .creation_flags(0x08000000);
            command
        };
        #[cfg(not(windows))]
        let mut command = {
            let mut command = Command::new("sh");
            command.args(["-c", "printf 'invalid announcement\n'; exec sleep 60"]);
            command
        };
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .expect("start a waiting process")
    }

    fn is_running(process: u32) -> bool {
        #[cfg(windows)]
        let output = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {process}"), "/NH", "/FO", "CSV"])
            .output()
            .expect("list processes");
        #[cfg(not(windows))]
        let output = Command::new("sh")
            .args([
                "-c",
                &format!("kill -0 {process} 2>/dev/null && echo {process}"),
            ])
            .output()
            .expect("probe the process");
        String::from_utf8_lossy(&output.stdout).contains(&process.to_string())
    }

    #[test]
    fn a_refused_announcement_reaps_the_started_process() {
        let mut server = OwnedProcess(waiting_child());
        let process = server.id();
        let error = announcement(&mut server).unwrap_err();
        assert!(
            error.to_string().contains("announcement is not JSON"),
            "{error}"
        );
        assert!(is_running(process), "the process waits until it is dropped");
        // Every error path out of the serve sequence drops the owned process.
        drop(server);
        assert!(!is_running(process), "a dropped engine is reaped");
    }

    #[test]
    fn a_failure_that_wrote_nothing_says_so() {
        assert_eq!(diagnostic(b""), "no error output");
        assert_eq!(diagnostic(b"  \n"), "no error output");
        assert_eq!(diagnostic(b"one\ntwo\n"), "one\ntwo");
    }
}
