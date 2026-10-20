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

/// The one served estate. `None` while nothing is being served.
#[derive(Default)]
pub struct EstateState(Mutex<Option<ServedEstate>>);

/// A served estate: the engine child this process started and its public
/// coordinates. Killing the child is the only way it is ever stopped.
pub struct ServedEstate {
    pub server: Child,
    pub view: ServedEstateView,
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
}

/// Non-secret engine-owned installation preview, before any installed state exists.
#[derive(Debug, Serialize)]
pub struct EstatePreview {
    pub project: String,
    pub mode: InstallMode,
    pub engine: EngineBinding,
    pub installation: Option<Value>,
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
    let installation = if project.join(LOCATOR).is_file() {
        None
    } else {
        Some(
            serde_json::from_slice(&installation_plan(&engine.path, &project, request.mode)?)
                .map_err(|error| format!("the installation plan is not JSON: {error}"))?,
        )
    };
    Ok(EstatePreview {
        project: project.to_string_lossy().into_owned(),
        mode: request.mode,
        engine,
        installation,
    })
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
    Ok(project)
}

fn installation_plan(
    executable: &Path,
    project: &Path,
    mode: InstallMode,
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
    if let Some(served) = state.0.lock().expect("estate state").as_ref() {
        return Ok(served.view.clone());
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
    if guard.is_some() {
        // Two serves raced; keep the first and stop the one we just started.
        let mut late = served;
        let _ = late.server.kill();
        let _ = late.server.wait();
        return Ok(guard.as_ref().map(|s| s.view.clone()).expect("checked"));
    }
    *guard = Some(served);
    Ok(view)
}

/// The estate this process is serving, if any, so a window can resume it.
#[tauri::command]
pub fn rrd_estate_status(state: State<'_, EstateState>) -> Option<ServedEstateView> {
    state
        .0
        .lock()
        .expect("estate state")
        .as_ref()
        .map(|served| served.view.clone())
}

/// Stops the served estate. Only the child this process started is ever
/// stopped; nothing is killed by name.
#[tauri::command]
pub fn rrd_estate_stop(app: AppHandle, state: State<'_, EstateState>) -> Result<bool, RrdError> {
    let served = state.0.lock().expect("estate state").take();
    match served {
        None => Ok(false),
        Some(mut served) => {
            let _ = served.server.kill();
            let _ = served.server.wait();
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

/// Stops the served estate when the application exits.
pub fn stop_on_exit(state: &EstateState) {
    if let Some(mut served) = state.0.lock().expect("estate state").take() {
        let _ = served.server.kill();
        let _ = served.server.wait();
    }
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
    let mut server = engine_command(&executable)
        .args(["--json", "serve", "--bind", "127.0.0.1:0", "--project"])
        .arg(&project)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("cannot start {}: {error}", executable.display()))?;
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
) -> Result<(), RrdError> {
    stage(
        app,
        "install",
        "running",
        "Sealing an installation plan for this project; nothing is written yet.",
    );
    let accepted_digest = accepted_digest
        .ok_or("Review and accept the installation preview before starting a new estate")?;
    let preview = installation_plan(executable, project, mode)?;
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
