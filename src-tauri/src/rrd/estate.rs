//! Serving a local estate from the desktop.
//!
//! This is the contracted sequence the RRD process tests drive, as product
//! commands: `rrflow install plan` and `install apply --expect <digest>` when
//! the project has no locator, then `--json serve --bind 127.0.0.1:0`, which
//! announces its loopback address on one stdout line, then `rrflow ready`
//! until the estate authenticates. Every boundary is reported to the webview
//! as a stage event so the serving panel can explain what is happening.
//!
//! The webview configures a project directory, an installation mode, and an
//! optional executable override — nothing else. RRFlow has one storage
//! engine, the kernel chooses the loopback port, and the operator credential
//! stays a file the native session reads; the renderer only ever holds its
//! path.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

use super::engine::{resolve_engine, EngineBinding, EngineSource};
use super::error::RrdError;
use crate::paths::get_data_directory;

/// How long a fresh install and the first open may take before serving is
/// declared failed. A debug engine on a cold cache stays well inside it.
const READY_TIMEOUT: Duration = Duration::from_secs(180);
const READY_POLL: Duration = Duration::from_millis(500);
/// The locator an installed project carries; its absence means "install".
const LOCATOR: &str = ".rrflow/config.toml";
/// The operator credential the installation wrote, relative to the project.
const OPERATOR_CREDENTIAL: &str = ".rrflow/credentials/local-operator.json";
const STAGE_EVENT: &str = "estate:stage";
const OUTPUT_EVENT: &str = "estate:output";

/// Only processes owned by this desktop, keyed by canonical project directory.
#[derive(Default, Clone)]
pub struct EstateState(Arc<Mutex<EstateRegistry>>);

#[derive(Default)]
struct EstateRegistry {
    closing: bool,
    projects: BTreeMap<PathBuf, Option<ServedEstate>>,
}

/// A reservation survives the blocking launch and releases on failure/panic.
struct StartingProject(EstateState, PathBuf);
impl Drop for StartingProject {
    fn drop(&mut self) {
        let mut registry = self.0 .0.lock().expect("estate state");
        if registry.projects.get(&self.1).is_some_and(Option::is_none) {
            registry.projects.remove(&self.1);
        }
    }
}

impl EstateState {
    pub fn start(
        &self,
        mut request: EstateServeRequest,
        observer: Arc<dyn ServeObserver>,
    ) -> Result<ServedEstateView, RrdError> {
        let project = project_directory(&request)?;
        request.project = project.to_string_lossy().into_owned();
        {
            let mut registry = self.0.lock().expect("estate state");
            if registry.closing {
                return Err("Connectome is shutting down".into());
            }
            if let Some(entry) = registry.projects.get_mut(&project) {
                let served = entry.as_mut().ok_or("this project is already starting")?;
                if served
                    .server
                    .try_wait()
                    .map_err(|e| format!("cannot inspect owned process: {e}"))?
                    .is_none()
                {
                    return Ok(served.view.clone());
                }
                registry.projects.remove(&project);
            }
            if registry.projects.len() >= 4 {
                return Err(
                    "four local project engines are already reserved; stop one first".into(),
                );
            }
            registry.projects.insert(project.clone(), None);
        }
        let _reservation = StartingProject(self.clone(), project.clone());
        let served = serve_estate(request, observer)?;
        let view = served.view.clone();
        let mut registry = self.0.lock().expect("estate state");
        if registry.closing {
            return Err("Connectome stopped during project startup".into());
        }
        registry.projects.insert(project, Some(served));
        Ok(view)
    }

    pub fn status(&self) -> Result<Vec<ServedEstateView>, RrdError> {
        let mut registry = self.0.lock().expect("estate state");
        let mut stopped = Vec::new();
        let mut views = Vec::new();
        for (project, entry) in &mut registry.projects {
            if let Some(served) = entry {
                if served
                    .server
                    .try_wait()
                    .map_err(|e| format!("cannot inspect owned process: {e}"))?
                    .is_some()
                {
                    stopped.push(project.clone());
                } else {
                    views.push(served.view.clone());
                }
            }
        }
        for project in stopped {
            registry.projects.remove(&project);
        }
        Ok(views)
    }

    pub fn stop(&self, project: &str) -> Result<bool, RrdError> {
        let mut registry = self.0.lock().expect("estate state");
        let key = PathBuf::from(project);
        if registry.projects.get(&key).is_some_and(Option::is_none) {
            return Err(
                "project startup is still running; wait for its result before stopping".into(),
            );
        }
        let Some(Some(served)) = registry.projects.get_mut(&key) else {
            return Ok(false);
        };
        if served
            .server
            .try_wait()
            .map_err(|e| format!("cannot inspect owned process: {e}"))?
            .is_none()
        {
            served
                .server
                .kill()
                .map_err(|e| format!("cannot stop owned engine: {e}"))?;
        }
        served
            .server
            .wait()
            .map_err(|e| format!("cannot reap owned engine: {e}"))?;
        registry.projects.remove(&key);
        Ok(true)
    }
}

/// A served estate: the engine child this process started and its public
/// coordinates. Killing the child is the only way it is ever stopped.
pub struct ServedEstate {
    pub server: OwnedProcess,
    pub view: ServedEstateView,
}

/// Reap a child on every error path, including an invalid announcement or
/// readiness command failure before a ServedEstate can be constructed.
pub struct OwnedProcess(Child);
impl std::ops::Deref for OwnedProcess {
    type Target = Child;
    fn deref(&self) -> &Child {
        &self.0
    }
}
impl std::ops::DerefMut for OwnedProcess {
    fn deref_mut(&mut self) -> &mut Child {
        &mut self.0
    }
}
impl Drop for OwnedProcess {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
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
pub struct EstateServeRequest {
    /// The project directory that holds, or will hold, the estate; empty
    /// means Connectome's default estate inside its data directory.
    #[serde(default)]
    pub project: String,
    /// Installation mode when the project has no locator yet.
    pub mode: InstallMode,
    /// An explicit `rrflow` executable; empty means the one on `PATH`.
    #[serde(default)]
    pub executable: String,
    /// Exact installation preview accepted by the operator; absent never installs.
    #[serde(default)]
    pub accepted_plan_sha256: Option<String>,
    /// The installation identity the preview was planned with. The engine
    /// binds every plan to one; the UI keeps it with its pending preview so
    /// the plan it applies is the plan the operator reviewed.
    #[serde(default)]
    pub installation_identity: Option<String>,
}

/// Non-secret engine-owned installation preview, before any installed state exists.
#[derive(Debug, Serialize)]
pub struct EstatePreview {
    pub project: String,
    pub mode: InstallMode,
    pub engine: EngineBinding,
    pub installation: Option<Value>,
    /// The identity this preview was planned with; present with `installation`.
    pub installation_identity: Option<String>,
}

#[tauri::command]
pub async fn rrd_estate_preview(request: EstateServeRequest) -> Result<EstatePreview, RrdError> {
    tauri::async_runtime::spawn_blocking(move || preview_estate(&request))
        .await
        .map_err(|error| RrdError::from(format!("preview task failed: {error}")))?
}

pub fn preview_estate(request: &EstateServeRequest) -> Result<EstatePreview, RrdError> {
    let project = project_directory(request)?;
    let engine = resolve_engine(&request.executable)?;
    let (installation, installation_identity) = if project.join(LOCATOR).is_file() {
        (None, None)
    } else {
        // A repeated preview of the same pending installation keeps its
        // identity; a first preview asks the engine for a new one.
        let identity = match &request.installation_identity {
            Some(identity) => valid_identity(identity)?,
            None => installation_identity(&engine.path)?,
        };
        let plan = installation_plan(&engine.path, &project, request.mode, &identity)?;
        (
            Some(
                serde_json::from_slice(&plan)
                    .map_err(|error| format!("the installation plan is not JSON: {error}"))?,
            ),
            Some(identity),
        )
    };
    Ok(EstatePreview {
        project: project.to_string_lossy().into_owned(),
        mode: request.mode,
        engine,
        installation,
        installation_identity,
    })
}

/// A new installation identity from the engine: 256 bits of OS entropy that
/// bind one installation's plans. It is not a credential and writes nothing.
fn installation_identity(executable: &Path) -> Result<String, RrdError> {
    let output = run(
        executable,
        &["--json".as_ref(), "install".as_ref(), "identity".as_ref()],
    )?;
    let value: Value = serde_json::from_slice(&output)
        .map_err(|error| format!("the installation identity is not JSON: {error}"))?;
    valid_identity(
        value["installation_identity"]
            .as_str()
            .ok_or("the engine did not return an installation identity")?,
    )
}

fn valid_identity(identity: &str) -> Result<String, RrdError> {
    if identity.len() == 64 && identity.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(identity.to_ascii_lowercase())
    } else {
        Err("the installation identity must be 64 hexadecimal digits".into())
    }
}

fn project_directory(request: &EstateServeRequest) -> Result<PathBuf, RrdError> {
    let project = match request.project.trim() {
        "" => get_data_directory().join(DEFAULT_ESTATE),
        configured => PathBuf::from(configured),
    };
    if !project.is_absolute() {
        return Err("the estate project must be an absolute directory path".into());
    }
    // Planning requires a directory; this does not create installed state.
    std::fs::create_dir_all(&project)
        .map_err(|error| format!("cannot create the project directory: {error}"))?;
    std::fs::canonicalize(project)
        .map_err(|error| format!("cannot resolve project directory: {error}").into())
}

fn installation_plan(
    executable: &Path,
    project: &Path,
    mode: InstallMode,
    identity: &str,
) -> Result<Vec<u8>, RrdError> {
    run(
        executable,
        &[
            "install".as_ref(),
            "plan".as_ref(),
            "--project".as_ref(),
            project.as_os_str(),
            "--mode".as_ref(),
            mode.argument().as_ref(),
            "--identity".as_ref(),
            identity.as_ref(),
        ],
    )
}

// Background engine helpers must not create a console window on Windows.
fn engine_command(executable: &Path) -> Command {
    let command = Command::new(executable);
    #[cfg(windows)]
    let command = {
        let mut command = command;
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
        command
    };
    command
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
    /// The engine that was run: where it is, how it was chosen, its digest.
    pub engine: EngineBinding,
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
    let owner = state.inner().clone();
    let project = request.project.clone();
    let observer: Arc<dyn ServeObserver> = Arc::new(ProjectObserver { app, project });
    tauri::async_runtime::spawn_blocking(move || owner.start(request, observer))
        .await
        .map_err(|e| RrdError::from(format!("serving task failed: {e}")))?
}

struct ProjectObserver {
    app: AppHandle,
    project: String,
}
impl ServeObserver for ProjectObserver {
    fn stage(&self, mut value: EstateStage) {
        value.detail = format!("[{}] {}", self.project, value.detail);
        let _ = self.app.emit(STAGE_EVENT, value);
    }
    fn output(&self, line: String) {
        let _ = self
            .app
            .emit(OUTPUT_EVENT, format!("[{}] {line}", self.project));
    }
}

#[tauri::command]
pub fn rrd_estate_status(state: State<'_, EstateState>) -> Result<Vec<ServedEstateView>, RrdError> {
    state.status()
}

#[tauri::command]
pub fn rrd_estate_stop(project: String, state: State<'_, EstateState>) -> Result<bool, RrdError> {
    state.stop(&project)
}

/// Shutdown marks the registry closed before dropping every owned child.
/// A launch finishing afterwards drops its child instead of publishing it.
pub fn stop_on_exit(state: &EstateState) {
    let projects = {
        let mut registry = state.0.lock().expect("estate state");
        registry.closing = true;
        std::mem::take(&mut registry.projects)
    };
    drop(projects);
}

/// Serves the requested estate: installs it when the project has no locator,
/// starts the engine on a kernel-chosen loopback port, and returns once the
/// estate answers an authenticated readiness check. This is the product
/// path; the RRD process tests drive it directly.
pub fn serve_estate(
    request: EstateServeRequest,
    observer: Arc<dyn ServeObserver>,
) -> Result<ServedEstate, RrdError> {
    let app = observer.as_ref();
    let project = project_directory(&request)?;

    // The engine: the configured override, else the bundled sidecar verified
    // against the digest this build embeds, else PATH. Reported first, so the
    // operator always sees which rrflow ran and what it hashed to.
    stage(
        app,
        "engine",
        "running",
        "Resolving the RRFlow engine this build is contracted to.",
    );
    let engine = resolve_engine(&request.executable).inspect_err(|error| {
        stage(app, "engine", "failed", error.message.clone());
    })?;
    stage(app, "engine", "done", describe_engine(&engine));
    let executable = engine.path.clone();

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
        install(
            app,
            &executable,
            &project,
            request.mode,
            request.accepted_plan_sha256.as_deref(),
            request.installation_identity.as_deref(),
        )?;
        true
    };

    // `serve --json` announces its address on one stdout line once bound; the
    // rest of its output goes to the serving console.
    stage(
        app,
        "serve",
        "running",
        "Starting the engine on a loopback port the kernel chooses.",
    );
    let mut server = OwnedProcess(
        engine_command(&executable)
            .args(["--json", "serve", "--bind", "127.0.0.1:0", "--project"])
            .arg(&project)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| format!("cannot start {}: {error}", executable.display()))?,
    );
    let stderr = server.stderr.take().expect("piped stderr");
    let console = Arc::clone(&observer);
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            console.output(line);
        }
    });
    let announced = announcement(&mut server)?;
    let endpoint = announced["url"]
        .as_str()
        .filter(|url| url.starts_with("http://127.0.0.1:"))
        .ok_or("the engine's announcement does not name a loopback HTTP address")?
        .to_owned();
    let instance = announced["instance_id"]
        .as_str()
        .ok_or("the engine's announcement does not name its instance")?
        .to_owned();
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
    let deadline = Instant::now() + READY_TIMEOUT;
    loop {
        let ready = engine_command(&executable)
            .args(["ready", "--address", &address, "--project"])
            .arg(&project)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|error| format!("cannot run rrflow ready: {error}"))?;
        if ready.success() {
            break;
        }
        if let Some(status) = server.try_wait().map_err(|error| error.to_string())? {
            stage(
                app,
                "serve",
                "failed",
                format!("The engine exited with {status}."),
            );
            return Err(format!("rrflow serve exited with {status} before it was ready").into());
        }
        if Instant::now() >= deadline {
            let _ = server.kill();
            let _ = server.wait();
            stage(
                app,
                "ready",
                "failed",
                "The estate did not become ready in time.",
            );
            return Err(format!("the estate was not ready after {READY_TIMEOUT:?}").into());
        }
        std::thread::sleep(READY_POLL);
    }
    stage(
        app,
        "ready",
        "done",
        "The estate answered an authenticated readiness check.",
    );

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
            engine,
        },
    })
}

fn describe_engine(engine: &EngineBinding) -> String {
    let digest = &engine.sha256[..12];
    match engine.source {
        EngineSource::Sidecar => format!(
            "Using the engine bundled with this build (sha256 {digest}…, RRFlow revision {}), verified against the build's manifest.",
            engine.revision.as_deref().map(|r| &r[..7.min(r.len())]).unwrap_or("unknown")
        ),
        EngineSource::Override => format!(
            "Using the configured executable {} (sha256 {digest}…).",
            engine.path.display()
        ),
        EngineSource::Path => format!(
            "No engine is bundled with this build; using {} from PATH (sha256 {digest}…).",
            engine.path.display()
        ),
    }
}

/// Plans the installation, accepts the plan by its digest, and applies it.
fn install(
    app: &dyn ServeObserver,
    executable: &Path,
    project: &Path,
    mode: InstallMode,
    accepted_digest: Option<&str>,
    identity: Option<&str>,
) -> Result<(), RrdError> {
    stage(
        app,
        "install",
        "running",
        "Sealing an installation plan for this project; nothing is written yet.",
    );
    let accepted_digest = accepted_digest
        .ok_or("Review and accept the installation preview before starting a new estate")?;
    // The reviewed preview's identity: planning again with it reproduces the
    // exact plan the operator accepted, or the digests differ below.
    let identity = valid_identity(
        identity.ok_or("Review the installation preview again; its identity is missing")?,
    )?;
    let preview = installation_plan(executable, project, mode, &identity)?;
    let plan: Value = serde_json::from_slice(&preview)
        .map_err(|error| format!("the installation plan is not JSON: {error}"))?;
    let digest = plan["installation"]["plan_sha256"]
        .as_str()
        .ok_or("the installation plan does not name its digest")?
        .to_owned();
    if accepted_digest != digest {
        return Err("The installation plan changed; review a fresh preview before applying".into());
    }
    let instance = plan["installation"]["target"]["instance_id"]
        .as_str()
        .unwrap_or("the estate")
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

/// Runs one `rrflow` command to completion and returns its standard output.
fn run(executable: &Path, arguments: &[&std::ffi::OsStr]) -> Result<Vec<u8>, RrdError> {
    let output = engine_command(executable)
        .args(arguments)
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("cannot run {}: {error}", executable.display()))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let detail = stderr.lines().last().unwrap_or("no error output").trim();
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
    let line = receiver.recv_timeout(READY_TIMEOUT).map_err(|_| {
        let _ = server.kill();
        let _ = server.wait();
        RrdError::from("rrflow serve did not announce its address")
    })?;
    serde_json::from_str(&line)
        .map_err(|error| format!("the engine's announcement is not JSON: {error}").into())
}

#[cfg(test)]
mod registry_tests {
    use super::*;
    struct Quiet;
    impl ServeObserver for Quiet {
        fn stage(&self, _: EstateStage) {}
        fn output(&self, _: String) {}
    }

    #[test]
    fn pending_start_capacity_and_failure_release_are_bounded() {
        let directory = std::env::temp_dir().join(format!(
            "connectome-registry-{}",
            uuid::Uuid::new_v4().simple()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        let key = std::fs::canonicalize(&directory).unwrap();
        let owner = EstateState::default();
        let request = EstateServeRequest {
            project: directory.to_string_lossy().into_owned(),
            mode: InstallMode::Fresh,
            executable: directory
                .join("missing-engine")
                .to_string_lossy()
                .into_owned(),
            accepted_plan_sha256: None,
            installation_identity: None,
        };
        let start = || owner.start(request.clone(), Arc::new(Quiet));
        owner.0.lock().unwrap().projects.insert(key.clone(), None);
        assert!(start().unwrap_err().message.contains("already starting"));
        assert!(owner
            .stop(key.to_str().unwrap())
            .unwrap_err()
            .message
            .contains("still running"));
        drop(StartingProject(owner.clone(), key.clone()));
        assert!(owner.0.lock().unwrap().projects.is_empty());
        for index in 0..4 {
            owner
                .0
                .lock()
                .unwrap()
                .projects
                .insert(key.join(index.to_string()), None);
        }
        assert!(start().unwrap_err().message.contains("four local"));
        owner.0.lock().unwrap().projects.clear();
        assert!(start().is_err(), "an absent executable cannot start");
        assert!(
            owner.0.lock().unwrap().projects.is_empty(),
            "failed startup releases capacity"
        );
        owner.0.lock().unwrap().closing = true;
        assert!(start().unwrap_err().message.contains("shutting down"));
        std::fs::remove_dir_all(directory).unwrap();
    }
}
