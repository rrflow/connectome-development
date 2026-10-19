//! Serving a local estate from the desktop.
//!
//! This is the contracted sequence the RRD process tests drive, as product
//! commands: `rrflow install plan` and `install apply --expect <digest>` when
//! the project has no locator, then `--json serve --bind 127.0.0.1:0`, which
//! announces its loopback address on one stdout line, then `rrflow ready`
//! authenticates the estate. Every boundary is reported to the webview
//! as a stage event so the serving panel can explain what is happening.
//!
//! The webview configures a project directory, an installation mode, and an
//! optional executable override — nothing else. RRFlow has one storage
//! engine, the kernel chooses the loopback port, and the operator credential
//! stays a file the native session reads; the renderer only ever holds its
//! path.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::net::{Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

use super::error::RrdError;
use super::transport::rrd_origin;
use crate::paths::get_data_directory;

/// Bounds the engine's initial open and listener announcement. Authenticated
/// readiness uses the CLI SDK's request timeout and preserves its failures.
const ANNOUNCEMENT_TIMEOUT: Duration = Duration::from_secs(180);
/// The locator an installed project carries; its absence means "install".
const LOCATOR: &str = ".rrflow/config.toml";
/// The operator credential the installation wrote, relative to the project.
const OPERATOR_CREDENTIAL: &str = ".rrflow/credentials/local-operator.json";
const DEFAULT_EXECUTABLE: &str = "rrflow";
const STAGE_EVENT: &str = "estate:stage";
const OUTPUT_EVENT: &str = "estate:output";

/// The one served estate. `None` while nothing is being served.
#[derive(Default)]
pub struct EstateState(Mutex<Option<ServedEstate>>);

/// A served estate: the engine child this process started and its public
/// coordinates. Killing the child is the only way it is ever stopped.
pub struct ServedEstate {
    pub server: Child,
    pub view: ServedEstateView,
}

impl Drop for ServedEstate {
    fn drop(&mut self) {
        let _ = self.server.kill();
        let _ = self.server.wait();
    }
}

/// Until startup has completed, every error and unwind must reap the child.
struct StartingServer<'a> {
    server: &'a mut Child,
    armed: bool,
}

impl<'a> StartingServer<'a> {
    fn new(server: &'a mut Child) -> Self {
        Self {
            server,
            armed: true,
        }
    }

    fn release(mut self) {
        self.armed = false;
    }
}

impl Drop for StartingServer<'_> {
    fn drop(&mut self) {
        if self.armed {
            let _ = self.server.kill();
            let _ = self.server.wait();
        }
    }
}

impl EstateState {
    fn current(&self) -> Result<Option<ServedEstateView>, RrdError> {
        observed_estate(&mut self.0.lock().expect("estate state"))
    }
}

/// A stored process handle is not evidence that the process is still serving.
fn observed_estate(
    served: &mut Option<ServedEstate>,
) -> Result<Option<ServedEstateView>, RrdError> {
    match served.as_mut() {
        None => Ok(None),
        Some(estate) => match estate.server.try_wait() {
            Ok(None) => Ok(Some(estate.view.clone())),
            Ok(Some(_)) => {
                *served = None;
                Ok(None)
            }
            Err(error) => Err(format!("cannot inspect the served RRFlow process: {error}").into()),
        },
    }
}

/// Where the serve sequence reports its boundaries and the engine's output.
/// The desktop forwards both to the webview; the process tests discard them.
pub trait ServeObserver: Send + Sync {
    fn stage(&self, stage: EstateStage);
    fn output(&self, line: String);
}

impl ServeObserver for AppHandle {
    fn stage(&self, stage: EstateStage) {
        let _ = self.emit(STAGE_EVENT, stage);
    }

    fn output(&self, line: String) {
        let _ = self.emit(OUTPUT_EVENT, line);
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallMode {
    Fresh,
    Existing,
}

impl InstallMode {
    fn argument(self) -> &'static str {
        match self {
            Self::Fresh => "fresh",
            Self::Existing => "existing",
        }
    }
}

/// Where Connectome keeps its own estate when no project is configured.
const DEFAULT_ESTATE: &str = "estates/local";

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case")]
pub enum EstateServeRequest {
    /// Open the saved estate at its exact saved origin. This operation cannot
    /// create a directory, install a locator, or choose another estate.
    OpenInstalled {
        project: String,
        endpoint: String,
        #[serde(default)]
        expected_instance: Option<String>,
        #[serde(default)]
        executable: String,
    },
    /// Installation is available only through this explicit operation.
    InstallAndServe {
        project: String,
        mode: InstallMode,
        #[serde(default)]
        executable: String,
    },
}

struct EstateTarget {
    project: PathBuf,
    executable: PathBuf,
    bind: SocketAddr,
    install_mode: Option<InstallMode>,
    expected_instance: Option<String>,
}

fn open_bind(endpoint: &str) -> Result<SocketAddr, RrdError> {
    let origin = rrd_origin(endpoint)?;
    if origin.scheme() != "http" || origin.host_str() != Some("127.0.0.1") {
        return Err("opening a saved local estate requires its HTTP origin on 127.0.0.1".into());
    }
    let port = origin
        .port_or_known_default()
        .filter(|port| *port != 0)
        .ok_or("opening a saved local estate requires its saved nonzero port")?;
    Ok(SocketAddr::from((Ipv4Addr::LOCALHOST, port)))
}

/// Resolves explicit intent without writing any project or invoking the CLI.
fn estate_target(request: &EstateServeRequest) -> Result<EstateTarget, RrdError> {
    match request {
        EstateServeRequest::OpenInstalled {
            project,
            endpoint,
            expected_instance,
            executable: configured,
        } => {
            if project.trim().is_empty() {
                return Err("select the existing installed estate's project directory; no default estate will be substituted".into());
            }
            let project = PathBuf::from(project.trim());
            if !project.is_absolute() || !project.is_dir() {
                return Err(
                    "the existing estate project must be an absolute directory that already exists"
                        .into(),
                );
            }
            if !project.join(LOCATOR).is_file() {
                return Err(format!("the existing project has no {LOCATOR} locator; opening it cannot install or replace an estate").into());
            }
            if let Some(instance) = expected_instance {
                rrd_contract::CanonicalId::new(instance.as_str())
                    .map_err(|error| format!("the saved expected instance is invalid: {error}"))?;
            }
            Ok(EstateTarget {
                project,
                executable: executable(configured),
                bind: open_bind(endpoint)?,
                install_mode: None,
                expected_instance: expected_instance.clone(),
            })
        }
        EstateServeRequest::InstallAndServe {
            project,
            mode,
            executable: configured,
        } => {
            let project = match project.trim() {
                "" => get_data_directory().join(DEFAULT_ESTATE),
                configured => PathBuf::from(configured),
            };
            if !project.is_absolute() {
                return Err("the installation project must be an absolute directory path".into());
            }
            Ok(EstateTarget {
                project,
                executable: executable(configured),
                bind: SocketAddr::from((Ipv4Addr::LOCALHOST, 0)),
                install_mode: Some(*mode),
                expected_instance: None,
            })
        }
    }
}

fn require_matching_estate(
    target: &EstateTarget,
    current: &ServedEstateView,
) -> Result<(), RrdError> {
    let same_project = std::fs::canonicalize(&target.project)
        .and_then(|requested| {
            std::fs::canonicalize(&current.project).map(|active| requested == active)
        })
        .unwrap_or(false);
    let same_endpoint = target.bind.port() == 0
        || open_bind(&current.endpoint).is_ok_and(|address| address == target.bind);
    let same_instance = target
        .expected_instance
        .as_ref()
        .is_none_or(|instance| instance == &current.instance);
    if !same_project || !same_endpoint || !same_instance {
        return Err("RRFlow is already serving a different project, endpoint, or instance; stop that estate explicitly before opening the saved profile".into());
    }
    Ok(())
}

/// The served estate as the webview may see it: coordinates only.
#[derive(Debug, Clone, Serialize)]
pub struct ServedEstateView {
    pub project: String,
    pub endpoint: String,
    pub instance: String,
    pub credential_path: String,
    /// Whether this serve installed the estate first.
    pub installed: bool,
}

/// One boundary of the serve sequence, reported as it is reached.
#[derive(Debug, Clone, Serialize)]
pub struct EstateStage {
    pub stage: &'static str,
    pub state: &'static str,
    pub detail: String,
}

fn stage(
    observer: &dyn ServeObserver,
    name: &'static str,
    state: &'static str,
    detail: impl Into<String>,
) {
    observer.stage(EstateStage {
        stage: name,
        state,
        detail: detail.into(),
    });
}

#[tauri::command]
pub async fn rrd_estate_serve(
    app: AppHandle,
    request: EstateServeRequest,
    state: State<'_, EstateState>,
) -> Result<ServedEstateView, RrdError> {
    let target = estate_target(&request)?;
    if let Some(view) = state.current()? {
        require_matching_estate(&target, &view)?;
        return Ok(view);
    }
    let observer: Arc<dyn ServeObserver> = Arc::new(app.clone());
    let served =
        tauri::async_runtime::spawn_blocking(move || serve_estate(request, observer)).await;
    let served = match served {
        Ok(Ok(served)) => served,
        Ok(Err(error)) => return Err(error),
        Err(error) => return Err(format!("serving task failed: {error}").into()),
    };
    let view = served.view.clone();
    let mut guard = state.0.lock().expect("estate state");
    if let Some(existing) = observed_estate(&mut guard)? {
        // Two serves raced; keep the first and stop the one we just started.
        drop(served);
        require_matching_estate(&target, &existing)?;
        return Ok(existing);
    }
    *guard = Some(served);
    Ok(view)
}

/// The estate this process is serving, if any, so a window can resume it.
#[tauri::command]
pub fn rrd_estate_status(
    state: State<'_, EstateState>,
) -> Result<Option<ServedEstateView>, RrdError> {
    state.current()
}

/// Stops the served estate. Only the child this process started is ever
/// stopped; nothing is killed by name.
#[tauri::command]
pub fn rrd_estate_stop(app: AppHandle, state: State<'_, EstateState>) -> Result<bool, RrdError> {
    let mut guard = state.0.lock().expect("estate state");
    match guard.as_mut() {
        None => Ok(false),
        Some(served) => {
            stop_server(&mut served.server)?;
            // Retain ownership if stopping fails so status and a later stop
            // can reconcile the actual child instead of reporting success.
            drop(guard.take());
            stage(
                &app as &dyn ServeObserver,
                "serve",
                "stopped",
                "RRFlow stopped",
            );
            Ok(true)
        }
    }
}

fn stop_server(server: &mut Child) -> Result<(), RrdError> {
    if server
        .try_wait()
        .map_err(|error| format!("cannot inspect the RRFlow process before stopping it: {error}"))?
        .is_none()
    {
        server
            .kill()
            .map_err(|error| format!("cannot stop the RRFlow process: {error}"))?;
    }
    server
        .wait()
        .map_err(|error| format!("cannot reap the stopped RRFlow process: {error}"))?;
    Ok(())
}

/// Stops the served estate when the application exits.
pub fn stop_on_exit(state: &EstateState) {
    drop(state.0.lock().expect("estate state").take());
}

/// Opens the explicit saved estate, or performs an explicitly requested
/// installation, through the same RRFlow CLI and authenticated readiness path.
pub fn serve_estate(
    request: EstateServeRequest,
    observer: Arc<dyn ServeObserver>,
) -> Result<ServedEstate, RrdError> {
    let app = observer.as_ref();
    let target = estate_target(&request)?;
    let project = target.project;
    if target.install_mode.is_some() {
        std::fs::create_dir_all(&project).map_err(|error| {
            format!("cannot create the installation project directory: {error}")
        })?;
    }
    let executable = target.executable;

    // Install when the project has no locator; otherwise open what is there.
    let installed = if project.join(LOCATOR).is_file() {
        stage(
            app,
            "install",
            "skipped",
            "This project is already an installed estate; its locator will be opened as it is.",
        );
        false
    } else {
        let mode = target.install_mode.ok_or(
            "the saved estate locator disappeared; opening it will not install a replacement",
        )?;
        install(app, &executable, &project, mode)?;
        true
    };

    // `serve --json` announces its address on one stdout line once bound; the
    // rest of its output goes to the serving console.
    stage(
        app,
        "serve",
        "running",
        if target.bind.port() == 0 {
            "Starting the explicitly selected installation on a kernel-chosen loopback port."
                .to_owned()
        } else {
            format!("Opening the existing estate at http://{}.", target.bind)
        },
    );
    let mut server = Command::new(&executable)
        .args(["--json", "serve", "--bind"])
        .arg(target.bind.to_string())
        .arg("--project")
        .arg(&project)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("cannot start {}: {error}", executable.display()))?;
    let starting = StartingServer::new(&mut server);
    let stderr = starting.server.stderr.take().expect("piped stderr");
    let console = Arc::clone(&observer);
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            console.output(line);
        }
    });
    let announced = announcement(starting.server)?;
    let (endpoint, instance) = announced_identity(&announced)?;
    if target.bind.port() != 0 && open_bind(&endpoint)? != target.bind {
        return Err(
            "the engine announced a different endpoint than the saved estate profile".into(),
        );
    }
    if target
        .expected_instance
        .as_ref()
        .is_some_and(|expected| expected != &instance)
    {
        return Err("the opened estate instance differs from the saved expected instance".into());
    }
    stage(
        app,
        "serve",
        "done",
        format!("Listening at {endpoint} as {instance}."),
    );

    // Authenticated readiness, as an operator's tooling checks it.
    stage(
        app,
        "ready",
        "running",
        "Authenticating against the estate with its operator credential.",
    );
    let address = endpoint.trim_start_matches("http://").to_owned();
    // The announcement is emitted after the HTTP listener binds. The CLI's
    // own SDK request timeout bounds this check; authentication and contract
    // rejections must retain their real text instead of being polled away.
    if let Err(error) = run(
        &executable,
        &[
            "ready".as_ref(),
            "--address".as_ref(),
            address.as_ref(),
            "--project".as_ref(),
            project.as_os_str(),
        ],
    ) {
        stage(app, "ready", "failed", &error.message);
        return Err(error);
    }
    if let Some(status) = starting
        .server
        .try_wait()
        .map_err(|error| error.to_string())?
    {
        let error = format!("rrflow serve exited with {status} before readiness completed");
        stage(app, "serve", "failed", &error);
        return Err(error.into());
    }
    stage(
        app,
        "ready",
        "done",
        "The estate answered an authenticated readiness check.",
    );

    starting.release();
    Ok(ServedEstate {
        server,
        view: ServedEstateView {
            project: project.to_string_lossy().into_owned(),
            endpoint,
            instance,
            credential_path: project
                .join(OPERATOR_CREDENTIAL)
                .to_string_lossy()
                .into_owned(),
            installed,
        },
    })
}

fn announced_identity(announced: &Value) -> Result<(String, String), RrdError> {
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

fn executable(configured: &str) -> PathBuf {
    let configured = configured.trim();
    if configured.is_empty() {
        PathBuf::from(DEFAULT_EXECUTABLE)
    } else {
        PathBuf::from(configured)
    }
}

/// Plans the installation, accepts the plan by its digest, and applies it.
fn install(
    app: &dyn ServeObserver,
    executable: &Path,
    project: &Path,
    mode: InstallMode,
) -> Result<(), RrdError> {
    stage(
        app,
        "install",
        "running",
        "Sealing an installation plan for this project; nothing is written yet.",
    );
    let preview = run(
        executable,
        &[
            "install".as_ref(),
            "plan".as_ref(),
            "--project".as_ref(),
            project.as_os_str(),
            "--mode".as_ref(),
            mode.argument().as_ref(),
        ],
    )?;
    let plan: Value = serde_json::from_slice(&preview)
        .map_err(|error| format!("the installation plan is not JSON: {error}"))?;
    let digest = plan["installation"]["plan_sha256"]
        .as_str()
        .ok_or("the installation plan does not name its digest")?
        .to_owned();
    validate_plan_digest(&digest)?;
    let instance = plan["installation"]["target"]["instance_id"]
        .as_str()
        .filter(|instance| !instance.is_empty())
        .ok_or("the installation plan does not name its target instance")?
        .to_owned();

    // The plan is an input to apply; it lives outside the project because the
    // plan hashes the project's inventory and a new file there would change it.
    let plans = get_data_directory().join("plans");
    std::fs::create_dir_all(&plans)
        .map_err(|error| format!("cannot create the plan directory: {error}"))?;
    let plan_path = plans.join(format!("{digest}.json"));
    std::fs::write(&plan_path, &preview)
        .map_err(|error| format!("cannot write the installation plan: {error}"))?;

    stage(
        app,
        "install",
        "running",
        format!("Applying plan {}… as {instance}.", &digest[..12]),
    );
    run(
        executable,
        &[
            "install".as_ref(),
            "apply".as_ref(),
            "--project".as_ref(),
            project.as_os_str(),
            "--mode".as_ref(),
            mode.argument().as_ref(),
            "--plan".as_ref(),
            plan_path.as_os_str(),
            "--expect".as_ref(),
            digest.as_ref(),
        ],
    )?;
    stage(
        app,
        "install",
        "done",
        format!("Installed {instance}: locator, storage root, token key, and operator credential are in place."),
    );
    Ok(())
}

fn validate_plan_digest(digest: &str) -> Result<(), RrdError> {
    if digest.len() != 64
        || !digest
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(
            "the installation plan digest must be exactly 64 lowercase hexadecimal characters"
                .into(),
        );
    }
    Ok(())
}

/// Runs one `rrflow` command to completion and returns its standard output.
fn run(executable: &Path, arguments: &[&std::ffi::OsStr]) -> Result<Vec<u8>, RrdError> {
    let output = Command::new(executable)
        .args(arguments)
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("cannot run {}: {error}", executable.display()))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if !stderr.trim().is_empty() {
            stderr.trim()
        } else if !stdout.trim().is_empty() {
            stdout.trim()
        } else {
            "no error output"
        };
        return Err(format!(
            "rrflow {} failed ({}): {detail}",
            arguments
                .iter()
                .take(2)
                .map(|argument| argument.to_string_lossy())
                .collect::<Vec<_>>()
                .join(" "),
            output.status
        )
        .into());
    }
    Ok(output.stdout)
}

/// The one-line JSON announcement `serve --json` prints once it is bound.
fn announcement(server: &mut Child) -> Result<Value, RrdError> {
    let stdout = server.stdout.take().expect("piped stdout");
    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut lines = BufReader::new(stdout).lines();
        if let Some(Ok(line)) = lines.next() {
            let _ = sender.send(line);
        }
        // Drain so the pipe never fills; later lines are not announcements.
        for _ in lines.map_while(Result::ok) {}
    });
    let line = receiver.recv_timeout(ANNOUNCEMENT_TIMEOUT).map_err(|_| {
        let _ = server.kill();
        let _ = server.wait();
        RrdError::from("rrflow serve did not announce its address")
    })?;
    serde_json::from_str(&line)
        .map_err(|error| format!("the engine's announcement is not JSON: {error}").into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn waiting_child() -> Child {
        #[cfg(windows)]
        let mut command = {
            use std::os::windows::process::CommandExt;
            let mut command = Command::new("powershell.exe");
            command
                .args([
                    "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
                    "[Console]::Out.WriteLine('invalid announcement'); [Console]::Out.Flush(); Start-Sleep -Seconds 60",
                ])
                .creation_flags(0x08000000);
            command
        };
        #[cfg(not(windows))]
        let mut command = {
            let mut command = Command::new("sh");
            command.args(["-c", "printf 'invalid announcement\\n'; exec sleep 60"]);
            command
        };
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .expect("start a disposable lifecycle test child")
    }

    fn test_view() -> ServedEstateView {
        ServedEstateView {
            project: "test-project".into(),
            endpoint: "http://127.0.0.1:9477".into(),
            instance: "test-instance".into(),
            credential_path: "test-credential-path".into(),
            installed: false,
        }
    }

    #[derive(Default)]
    struct RecordingObserver(Mutex<Vec<EstateStage>>);

    impl ServeObserver for RecordingObserver {
        fn stage(&self, stage: EstateStage) {
            self.0.lock().unwrap().push(stage);
        }

        fn output(&self, _line: String) {}
    }

    #[test]
    fn opening_a_missing_estate_never_creates_or_installs_a_replacement() {
        let project = std::env::temp_dir().join(format!(
            "connectome-missing-estate-{}",
            uuid::Uuid::new_v4()
        ));
        let observer = Arc::new(RecordingObserver::default());
        let error = serve_estate(
            EstateServeRequest::OpenInstalled {
                project: project.to_string_lossy().into_owned(),
                endpoint: "http://127.0.0.1:9477".into(),
                expected_instance: Some("saved-instance".into()),
                executable: "must-not-be-invoked".into(),
            },
            observer.clone(),
        );
        let error = match error {
            Err(error) => error,
            Ok(_) => panic!("opening a missing estate must fail"),
        };
        assert!(error.message.contains("already exists"));
        assert!(!project.exists());
        assert!(observer.0.lock().unwrap().is_empty());
    }

    #[test]
    fn opening_an_existing_directory_without_its_locator_is_a_read_only_denial() {
        // This is an empty-directory denial test, never a substitute estate or
        // installation fixture. The configured executable must not be run.
        let project =
            std::env::temp_dir().join(format!("connectome-no-locator-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&project).unwrap();
        let observer = Arc::new(RecordingObserver::default());
        let result = serve_estate(
            EstateServeRequest::OpenInstalled {
                project: project.to_string_lossy().into_owned(),
                endpoint: "http://127.0.0.1:9477".into(),
                expected_instance: None,
                executable: "must-not-be-invoked".into(),
            },
            observer.clone(),
        );
        let entries = std::fs::read_dir(&project).unwrap().count();
        std::fs::remove_dir(&project).unwrap();
        let error = match result {
            Err(error) => error,
            Ok(_) => panic!("an existing project without its locator must be rejected"),
        };
        assert!(error.message.contains(LOCATOR));
        assert_eq!(entries, 0, "opening cannot scaffold or install anything");
        assert!(observer.0.lock().unwrap().is_empty());
    }

    #[test]
    fn opening_reuses_only_the_exact_saved_project_origin_and_instance() {
        let project = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let mut view = test_view();
        view.project = project.to_string_lossy().into_owned();
        let target = EstateTarget {
            project: project.clone(),
            executable: PathBuf::from("not-invoked"),
            bind: open_bind("http://127.0.0.1:9477").unwrap(),
            install_mode: None,
            expected_instance: Some(view.instance.clone()),
        };
        assert!(require_matching_estate(&target, &view).is_ok());
        view.endpoint = "http://127.0.0.1:9478".into();
        assert!(require_matching_estate(&target, &view).is_err());
        view.endpoint = "http://127.0.0.1:9477".into();
        view.instance = "another-instance".into();
        assert!(require_matching_estate(&target, &view).is_err());
        view.instance = "test-instance".into();
        view.project = project.parent().unwrap().to_string_lossy().into_owned();
        assert!(require_matching_estate(&target, &view).is_err());
        assert!(open_bind("http://127.0.0.1:0").is_err());
        assert!(open_bind("http://127.0.0.1:9477/path").is_err());
        assert!(open_bind("https://127.0.0.1:9477").is_err());
    }

    #[test]
    fn estate_requests_require_explicit_open_or_install_intent() {
        assert!(serde_json::from_value::<EstateServeRequest>(json!({
            "project": "", "mode": "fresh", "executable": "rrflow",
        }))
        .is_err());
        assert!(serde_json::from_value::<EstateServeRequest>(json!({
            "operation": "open_installed", "project": "saved-project",
            "endpoint": "http://127.0.0.1:9477", "expected_instance": "saved-instance",
        }))
        .is_ok());
        assert!(serde_json::from_value::<EstateServeRequest>(json!({
            "operation": "install_and_serve", "project": "", "mode": "fresh",
        }))
        .is_ok());
    }

    #[test]
    fn failed_announcement_reaps_the_started_process() {
        let mut child = waiting_child();
        let result = {
            let starting = StartingServer::new(&mut child);
            announcement(starting.server)
        };
        assert!(result
            .unwrap_err()
            .message
            .contains("announcement is not JSON"));
        assert!(child
            .try_wait()
            .expect("inspect cleaned-up child")
            .is_some());
    }

    #[test]
    fn stored_estate_is_removed_after_its_process_exits() {
        let state = EstateState(Mutex::new(Some(ServedEstate {
            server: waiting_child(),
            view: test_view(),
        })));
        assert_eq!(
            state
                .current()
                .expect("observe live child")
                .unwrap()
                .instance,
            "test-instance"
        );
        {
            let mut guard = state.0.lock().unwrap();
            let estate = guard.as_mut().unwrap();
            estate.server.kill().expect("stop disposable child");
            estate.server.wait().expect("reap disposable child");
        }
        assert!(state.current().expect("observe exited child").is_none());
        assert!(
            state.0.lock().unwrap().is_none(),
            "dead handles cannot be resumed"
        );
    }

    #[test]
    fn explicit_stop_reaps_only_its_owned_child_and_is_repeatable() {
        let mut child = waiting_child();
        let guard = StartingServer::new(&mut child);
        stop_server(guard.server).expect("stop the owned process");
        assert!(guard.server.try_wait().unwrap().is_some());
        stop_server(guard.server).expect("reconcile an already stopped process");
    }

    #[test]
    fn command_failures_keep_the_native_diagnostic_in_full() {
        #[cfg(windows)]
        let (executable, arguments) = (
            Path::new("powershell.exe"),
            vec!["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
                 "[Console]::Error.WriteLine('authentication diagnostic'); [Console]::Error.WriteLine('error: RRD API 401 Unauthorized: operator credential rejected'); exit 23"],
        );
        #[cfg(not(windows))]
        let (executable, arguments) = (
            Path::new("sh"),
            vec!["-c", "printf 'authentication diagnostic\\nerror: RRD API 401 Unauthorized: operator credential rejected\\n' >&2; exit 23"],
        );
        let arguments: Vec<&std::ffi::OsStr> = arguments.iter().map(std::ffi::OsStr::new).collect();
        let error = run(executable, &arguments).unwrap_err();
        assert!(error.message.contains("authentication diagnostic"));
        assert!(error
            .message
            .contains("RRD API 401 Unauthorized: operator credential rejected"));
        assert!(!error.message.contains("180s"));
    }

    #[test]
    fn installation_digest_is_checked_before_path_or_prefix_use() {
        assert!(validate_plan_digest(&"ab01".repeat(16)).is_ok());
        for invalid in [
            "".to_owned(),
            "abc".into(),
            "A".repeat(64),
            "g".repeat(64),
            "é".repeat(32),
        ] {
            assert!(
                validate_plan_digest(&invalid).is_err(),
                "invalid digest: {invalid}"
            );
        }
    }

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
        assert!(announced_identity(&json!({ "status": "ready", "url": "http://127.0.0.1:9477", "instance_id": "test-instance" })).is_err());
    }
}
