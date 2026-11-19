//! Each project's RRFlow instance as the desktop knows it, whichever way it
//! was started (sprint 009, decision 19).
//!
//! Connectome starts an instance itself, or attaches to one started elsewhere,
//! for example by `rrflow` in the project folder. RRFlow's served endpoint
//! record (`.rrflow/serving.json`) says where such an instance listens, but it
//! is only a hint: `rrflow ready --project` grants readiness with its
//! authenticated challenge, and the liveness check that follows can only take
//! readiness away. Connectome stops only the instances it started.
//!
//! A tracked instance is starting, ready, stopping or failed; a project with no
//! entry is stopped. Every transition is numbered and sent to the webview as
//! one `engram:lifecycle` event naming its project, so a status read that
//! arrives after a newer event can be recognised as older.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, Weak};
use std::time::SystemTime;
use tauri::{AppHandle, Emitter, State};
use tokio::task::JoinSet;

use super::{
    endpoint_credentials_path, engine_stage, project_directory, prove_elsewhere, serve_with, stage,
    EngramServeRequest, EngramStage, ServeObserver, ServedEngram, ServedEngramView, DEFAULT_ENGRAM,
    LOCATOR, OUTPUT_EVENT, SERVING_RECORD, STAGE_EVENT,
};
use crate::paths::get_data_directory;
use crate::rrd::client::answers_as;
use crate::rrd::engine::resolve_engine;
use crate::rrd::error::RrdError;

pub(super) const LIFECYCLE_EVENT: &str = "engram:lifecycle";
/// A running instance keeps the startup configuration it was started with;
/// an endpoint credential mapping applies only to a start of `rrflow serve`.
const RUNNING_WITH_STARTUP: &str =
    "this project is already running; open it or stop it before applying endpoint startup configuration";
const RUNNING_ELSEWHERE_WITH_STARTUP: &str = "this project is already running outside Connectome; open it, or stop it where it was started before applying endpoint startup configuration";
/// What a removed project's instance is told when another process serves it.
const FORGOTTEN_ELSEWHERE: &str =
    "Removed from Connectome; the instance started outside Connectome keeps running.";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Origin {
    /// Started by this desktop, which owns the process.
    Connectome,
    /// Started elsewhere, for example from the project folder.
    Elsewhere,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InstanceState {
    Starting,
    Ready,
    Stopping,
    Stopped,
    Failed,
}

/// One project's instance as the webview may see it.
#[derive(Debug, Clone, Serialize)]
pub struct InstanceView {
    pub project: String,
    pub state: InstanceState,
    pub origin: Origin,
    /// The boundary a start or an attach last reached, or where it failed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage: Option<&'static str>,
    /// What this state means for this instance, in the engine's or
    /// Connectome's own words.
    pub detail: String,
    /// The instance's coordinates once it is ready.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engram: Option<ServedEngramView>,
    /// The registry's transition number when this view was taken.
    pub revision: u64,
}

/// Diagnostic observation only: the engine and its readiness proof remain the
/// authorities. Do not log project paths, credentials, endpoints or output.
pub(super) fn trace_lifecycle(instance: &InstanceView) {
    let instance_id = instance
        .engram
        .as_ref()
        .map(|engram| engram.instance.as_str());
    log::info!(
        target: "connectome::instance",
        "[connectome::instance] revision={} state={:?} origin={:?} stage={:?} instance={:?}",
        instance.revision,
        instance.state,
        instance.origin,
        instance.stage,
        instance_id,
    );
}

/// The projects the webview knows and the engine it would prove them with.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StatusRequest {
    #[serde(default)]
    pub projects: Vec<String>,
    #[serde(default)]
    pub executable: String,
}

/// Every tracked instance, as of one transition number.
#[derive(Debug, Clone, Serialize)]
pub struct StatusView {
    pub revision: u64,
    pub instances: Vec<InstanceView>,
}

enum Entry {
    /// A start or an attach is under way.
    Starting {
        origin: Origin,
        stage: Option<&'static str>,
        detail: String,
    },
    /// The engine child this desktop started.
    Owned(ServedEngram),
    /// An instance started elsewhere and proved by `rrflow ready`.
    Attached(ServedEngramView),
    /// The owned engine is being stopped.
    Stopping,
    /// A start or an attach failed, or the owned engine exited by itself.
    /// Kept until the project is started again or the failure is dismissed.
    Failed {
        origin: Origin,
        stage: &'static str,
        detail: String,
    },
}

impl Entry {
    fn origin(&self) -> Origin {
        match self {
            Self::Starting { origin, .. } | Self::Failed { origin, .. } => *origin,
            Self::Owned(_) | Self::Stopping => Origin::Connectome,
            Self::Attached(_) => Origin::Elsewhere,
        }
    }

    fn view(&self, project: &Path, revision: u64) -> InstanceView {
        let (state, stage, detail, engram) = match self {
            Self::Starting { stage, detail, .. } => (
                InstanceState::Starting,
                *stage,
                if detail.is_empty() {
                    "Connectome is starting this project.".to_owned()
                } else {
                    detail.clone()
                },
                None,
            ),
            Self::Owned(served) => (
                InstanceState::Ready,
                None,
                format!("Serving at {}.", served.view.endpoint),
                Some(served.view.clone()),
            ),
            Self::Attached(view) => (
                InstanceState::Ready,
                None,
                format!("Started outside Connectome; serving at {}.", view.endpoint),
                Some(view.clone()),
            ),
            Self::Stopping => (
                InstanceState::Stopping,
                None,
                "Stopping the engine this desktop started.".to_owned(),
                None,
            ),
            Self::Failed { stage, detail, .. } => {
                (InstanceState::Failed, Some(*stage), detail.clone(), None)
            }
        };
        InstanceView {
            project: project.to_string_lossy().into_owned(),
            state,
            origin: self.origin(),
            stage,
            detail,
            engram,
            revision,
        }
    }
}

struct Tracked {
    entry: Entry,
    revision: u64,
}

/// The served endpoint record as last seen when it failed to prove itself:
/// its size and modification time. The same record is not proved again.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RecordHint(u64, Option<SystemTime>);

fn record_hint(project: &Path) -> Option<RecordHint> {
    let metadata = std::fs::metadata(project.join(SERVING_RECORD)).ok()?;
    metadata
        .is_file()
        .then(|| RecordHint(metadata.len(), metadata.modified().ok()))
}

#[derive(Default)]
struct EngramRegistry {
    closing: bool,
    revision: u64,
    projects: BTreeMap<PathBuf, Tracked>,
    unproved: BTreeMap<PathBuf, RecordHint>,
}

impl EngramRegistry {
    /// Records one transition; the returned view is sent once the lock is
    /// released.
    fn set(&mut self, project: &Path, entry: Entry) -> InstanceView {
        self.revision += 1;
        let view = entry.view(project, self.revision);
        self.projects.insert(
            project.to_path_buf(),
            Tracked {
                entry,
                revision: self.revision,
            },
        );
        view
    }

    /// Stops tracking a project; its instance is stopped as far as
    /// Connectome knows.
    fn remove(&mut self, project: &Path, detail: String) -> InstanceView {
        self.revision += 1;
        let origin = self
            .projects
            .remove(project)
            .map_or(Origin::Connectome, |tracked| tracked.entry.origin());
        InstanceView {
            project: project.to_string_lossy().into_owned(),
            state: InstanceState::Stopped,
            origin,
            stage: None,
            detail,
            engram: None,
            revision: self.revision,
        }
    }

    fn status(&self) -> StatusView {
        StatusView {
            revision: self.revision,
            instances: self
                .projects
                .iter()
                .map(|(project, tracked)| tracked.entry.view(project, tracked.revision))
                .collect(),
        }
    }
}

/// Every project instance this desktop knows, keyed by canonical project
/// directory.
#[derive(Default, Clone)]
pub struct EngramState(Arc<Mutex<EngramRegistry>>);

/// A reservation survives the blocking launch and releases on panic.
struct Reservation(EngramState, PathBuf);
impl Drop for Reservation {
    fn drop(&mut self) {
        let mut registry = self.0.lock();
        if registry.projects.get(&self.1).is_some_and(|tracked| {
            matches!(
                tracked.entry,
                Entry::Starting {
                    origin: Origin::Connectome,
                    ..
                }
            )
        }) {
            registry.projects.remove(&self.1);
        }
    }
}

/// How one start ended.
enum Launched {
    Owned(ServedEngram),
    Attached(ServedEngramView),
}

/// Follows a start's stages into its lifecycle entry, then passes each one on.
/// The engine's console thread keeps its observer as long as the engine runs,
/// so the registry is held weakly: the registry owns the engine, and dropping
/// it must still stop the engine.
struct Tracking {
    registry: Weak<Mutex<EngramRegistry>>,
    project: PathBuf,
    inner: Arc<dyn ServeObserver>,
    reached: Mutex<Option<&'static str>>,
}

impl Tracking {
    fn reached(&self) -> Option<&'static str> {
        *self.reached.lock().expect("start stage")
    }
}

impl ServeObserver for Tracking {
    fn stage(&self, stage: EngramStage) {
        if matches!(stage.state, "running" | "failed") {
            *self.reached.lock().expect("start stage") = Some(stage.stage);
        }
        if stage.state == "running" {
            let view = self.registry.upgrade().and_then(|registry| {
                let mut registry = registry.lock().expect("engram state");
                let starting = registry
                    .projects
                    .get(&self.project)
                    .is_some_and(|tracked| matches!(tracked.entry, Entry::Starting { .. }));
                starting.then(|| {
                    registry.set(
                        &self.project,
                        Entry::Starting {
                            origin: Origin::Connectome,
                            stage: Some(stage.stage),
                            detail: stage.detail.clone(),
                        },
                    )
                })
            });
            if let Some(view) = view {
                self.inner.lifecycle(view);
            }
        }
        self.inner.stage(stage);
    }

    fn output(&self, line: String) {
        self.inner.output(line);
    }

    fn lifecycle(&self, instance: InstanceView) {
        self.inner.lifecycle(instance);
    }
}

/// Proves the instance an existing record names: the outer error means the
/// proof itself cannot be accepted, the inner one that nothing proved itself.
type Prover =
    dyn Fn(&str, &Path) -> Result<Result<ServedEngramView, String>, RrdError> + Send + Sync;

fn prove_with_engine(
    executable: &str,
    project: &Path,
) -> Result<Result<ServedEngramView, String>, RrdError> {
    let engine = resolve_engine(executable)?;
    prove_elsewhere(&engine.path, project)
}

impl EngramState {
    fn lock(&self) -> MutexGuard<'_, EngramRegistry> {
        self.0.lock().expect("engram state")
    }

    /// Starts or attaches to the project's instance and returns once it is
    /// ready. A project already ready returns its instance; an installed
    /// project that another process serves is attached instead of served.
    pub fn start(
        &self,
        mut request: EngramServeRequest,
        observer: Arc<dyn ServeObserver>,
    ) -> Result<ServedEngramView, RrdError> {
        request.endpoint_credentials =
            endpoint_credentials_path(request.endpoint_credentials.as_deref())?
                .map(|path| path.to_string_lossy().into_owned());
        let project = project_directory(&request)?;
        request.project = project.to_string_lossy().into_owned();
        let reserved = {
            let mut registry = self.lock();
            if registry.closing {
                return Err("Connectome is shutting down".into());
            }
            match registry.projects.get_mut(&project).map(|t| &mut t.entry) {
                Some(Entry::Starting { .. }) => {
                    return Err("this project is already starting".into());
                }
                Some(Entry::Stopping) => {
                    return Err(
                        "this project's engine is stopping; start it again once it has stopped"
                            .into(),
                    );
                }
                Some(Entry::Attached(view)) => {
                    if request.endpoint_credentials.is_some() {
                        return Err(RUNNING_ELSEWHERE_WITH_STARTUP.into());
                    }
                    return Ok(view.clone());
                }
                Some(Entry::Owned(served)) => {
                    if served
                        .server
                        .try_wait()
                        .map_err(|e| format!("cannot inspect owned process: {e}"))?
                        .is_none()
                    {
                        if request.endpoint_credentials.is_some()
                            || served.view.endpoint_credentials.is_some()
                        {
                            return Err(RUNNING_WITH_STARTUP.into());
                        }
                        return Ok(served.view.clone());
                    }
                }
                Some(Entry::Failed { .. }) | None => {}
            }
            registry.set(
                &project,
                Entry::Starting {
                    origin: Origin::Connectome,
                    stage: None,
                    detail: String::new(),
                },
            )
        };
        observer.lifecycle(reserved);
        let _reservation = Reservation(self.clone(), project.clone());
        let tracking = Arc::new(Tracking {
            registry: Arc::downgrade(&self.0),
            project: project.clone(),
            inner: Arc::clone(&observer),
            reached: Mutex::new(None),
        });
        let launched = launch(request, &project, Arc::clone(&tracking));
        let (result, view) = {
            let mut registry = self.lock();
            if registry.closing {
                return Err("Connectome stopped during project startup".into());
            }
            match launched {
                Ok(Launched::Owned(served)) => {
                    let ready = served.view.clone();
                    (Ok(ready), registry.set(&project, Entry::Owned(served)))
                }
                Ok(Launched::Attached(ready)) => {
                    let view = registry.set(&project, Entry::Attached(ready.clone()));
                    (Ok(ready), view)
                }
                Err(error) => {
                    let view = match tracking.reached() {
                        Some(stage) => registry.set(
                            &project,
                            Entry::Failed {
                                origin: if stage == "attach" {
                                    Origin::Elsewhere
                                } else {
                                    Origin::Connectome
                                },
                                stage,
                                detail: error.message.clone(),
                            },
                        ),
                        None => registry.remove(&project, error.message.clone()),
                    };
                    (Err(error), view)
                }
            }
        };
        observer.lifecycle(view);
        result
    }

    /// Every tracked instance, without looking at any of them.
    #[cfg(test)]
    pub fn status(&self) -> StatusView {
        self.lock().status()
    }

    /// Looks at every tracked instance and at the known projects, then
    /// returns them all. An owned engine that exited is failed; an attached
    /// instance that no longer answers as itself is stopped; a known project
    /// whose served endpoint record is new since it last failed to prove
    /// itself is proved and attached.
    pub async fn refresh(
        &self,
        request: StatusRequest,
        observer: Arc<dyn ServeObserver>,
    ) -> Result<StatusView, RrdError> {
        self.refresh_with(request, observer, Arc::new(prove_with_engine))
            .await
    }

    async fn refresh_with(
        &self,
        request: StatusRequest,
        observer: Arc<dyn ServeObserver>,
        prove: Arc<Prover>,
    ) -> Result<StatusView, RrdError> {
        let known: Vec<PathBuf> = request
            .projects
            .iter()
            .filter_map(|project| known_directory(project))
            .collect();
        let mut events = Vec::new();
        let (checks, proofs) = {
            let mut registry = self.lock();
            let mut exited = Vec::new();
            let mut checks = Vec::new();
            for (project, tracked) in &mut registry.projects {
                match &mut tracked.entry {
                    Entry::Owned(served) => {
                        if let Ok(Some(status)) = served.server.try_wait() {
                            exited.push((project.clone(), status));
                        }
                    }
                    Entry::Attached(view) => checks.push((
                        project.clone(),
                        view.endpoint.clone(),
                        view.instance.clone(),
                    )),
                    _ => {}
                }
            }
            for (project, status) in exited {
                events.push(registry.set(
                    &project,
                    Entry::Failed {
                        origin: Origin::Connectome,
                        stage: "serve",
                        detail: format!("The engine exited with {status}."),
                    },
                ));
            }
            let mut proofs = Vec::new();
            for project in known {
                if registry.projects.contains_key(&project) {
                    continue;
                }
                let Some(hint) = record_hint(&project) else {
                    registry.unproved.remove(&project);
                    continue;
                };
                if registry.unproved.get(&project) == Some(&hint) {
                    continue;
                }
                events.push(registry.set(
                    &project,
                    Entry::Starting {
                        origin: Origin::Elsewhere,
                        stage: Some("attach"),
                        detail: "Another process recorded an endpoint for this project; proving it with the project's operator credential.".into(),
                    },
                ));
                proofs.push((project, hint));
            }
            (checks, proofs)
        };
        for event in events.drain(..) {
            observer.lifecycle(event);
        }

        let mut probes = JoinSet::new();
        for (project, endpoint, instance) in checks {
            probes.spawn(async move {
                let answered = answers_as(&endpoint, &instance).await;
                (project, endpoint, instance, answered)
            });
        }
        let mut lost = Vec::new();
        while let Some(probe) = probes.join_next().await {
            if let Ok((project, endpoint, instance, Err(error))) = probe {
                lost.push((project, endpoint, instance, error));
            }
        }
        let mut proved = Vec::new();
        for (project, hint) in proofs {
            let prove = Arc::clone(&prove);
            let executable = request.executable.clone();
            let directory = project.clone();
            let result =
                tauri::async_runtime::spawn_blocking(move || prove(&executable, &directory))
                    .await
                    .unwrap_or_else(|error| Err(format!("proof task failed: {error}").into()));
            proved.push((project, hint, result));
        }

        let status = {
            let mut registry = self.lock();
            for (project, endpoint, instance, error) in lost {
                let same = registry.projects.get(&project).is_some_and(|tracked| {
                    matches!(&tracked.entry, Entry::Attached(view)
                        if view.endpoint == endpoint && view.instance == instance)
                });
                if same {
                    events.push(registry.remove(
                        &project,
                        format!(
                            "The instance started outside Connectome no longer answers at {endpoint}: {}",
                            error.message
                        ),
                    ));
                }
            }
            for (project, hint, result) in proved {
                let attaching = registry.projects.get(&project).is_some_and(|tracked| {
                    matches!(
                        tracked.entry,
                        Entry::Starting {
                            origin: Origin::Elsewhere,
                            ..
                        }
                    )
                });
                if !attaching {
                    continue;
                }
                events.push(match result {
                    Ok(Ok(view)) => {
                        registry.unproved.remove(&project);
                        registry.set(&project, Entry::Attached(view))
                    }
                    Ok(Err(reason)) => {
                        registry.unproved.insert(project.clone(), hint);
                        registry.remove(
                            &project,
                            format!("The endpoint recorded for this project did not prove itself: {reason}"),
                        )
                    }
                    Err(error) => {
                        registry.unproved.insert(project.clone(), hint);
                        registry.set(
                            &project,
                            Entry::Failed {
                                origin: Origin::Elsewhere,
                                stage: "attach",
                                detail: error.message,
                            },
                        )
                    }
                });
            }
            registry.status()
        };
        for event in events {
            observer.lifecycle(event);
        }
        Ok(status)
    }

    /// Stops the engine this desktop started for `project`, or dismisses its
    /// failure. An instance started elsewhere is never stopped from here.
    /// Returns whether an engine was stopped.
    pub fn stop(&self, project: &str, observer: &dyn ServeObserver) -> Result<bool, RrdError> {
        let key = PathBuf::from(project);
        let (mut served, stopping) = {
            let mut registry = self.lock();
            match registry.projects.get(&key).map(|tracked| &tracked.entry) {
                None => return Ok(false),
                Some(Entry::Starting { .. }) => {
                    return Err(
                        "project startup is still running; wait for its result before stopping"
                            .into(),
                    );
                }
                Some(Entry::Stopping) => {
                    return Err("this project's engine is already stopping".into());
                }
                Some(Entry::Attached(_)) => {
                    return Err(
                        "this instance was started outside Connectome; stop it where it was started"
                            .into(),
                    );
                }
                Some(Entry::Failed { .. }) => {
                    let view = registry.remove(&key, "The failure was dismissed.".into());
                    drop(registry);
                    observer.lifecycle(view);
                    return Ok(false);
                }
                Some(Entry::Owned(_)) => {}
            }
            registry.revision += 1;
            let revision = registry.revision;
            let tracked = registry
                .projects
                .insert(
                    key.clone(),
                    Tracked {
                        entry: Entry::Stopping,
                        revision,
                    },
                )
                .expect("owned entry");
            let Entry::Owned(served) = tracked.entry else {
                unreachable!("matched as owned above")
            };
            (served, Entry::Stopping.view(&key, revision))
        };
        observer.lifecycle(stopping);
        let stopped = (|| -> Result<(), RrdError> {
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
            Ok(())
        })();
        let view = {
            let mut registry = self.lock();
            match &stopped {
                Ok(()) => registry.remove(&key, "Stopped by Connectome.".into()),
                Err(error) => registry.set(
                    &key,
                    Entry::Failed {
                        origin: Origin::Connectome,
                        stage: "stop",
                        detail: error.message.clone(),
                    },
                ),
            }
        };
        observer.lifecycle(view);
        stopped.map(|()| true)
    }

    /// Stops tracking a project that was removed from Connectome. The engine
    /// this desktop started is stopped and a failure is dismissed, as `stop`
    /// does. An instance started elsewhere keeps running and is only
    /// forgotten: its served endpoint record is remembered as already looked
    /// at, so a status read still naming the project does not attach it
    /// again. The project's files are never touched. Returns whether an
    /// engine was stopped.
    pub fn forget(&self, project: &str, observer: &dyn ServeObserver) -> Result<bool, RrdError> {
        let key = PathBuf::from(project);
        let forgotten = {
            let mut registry = self.lock();
            let attached = matches!(
                registry.projects.get(&key).map(|tracked| &tracked.entry),
                Some(Entry::Attached(_))
            );
            attached.then(|| {
                match record_hint(&key) {
                    Some(hint) => registry.unproved.insert(key.clone(), hint),
                    None => registry.unproved.remove(&key),
                };
                registry.remove(&key, FORGOTTEN_ELSEWHERE.into())
            })
        };
        match forgotten {
            Some(view) => {
                observer.lifecycle(view);
                Ok(false)
            }
            None => self.stop(project, observer),
        }
    }
}

/// The engine, an instance started elsewhere if the project has one, else
/// the serve sequence.
fn launch(
    request: EngramServeRequest,
    project: &Path,
    observer: Arc<Tracking>,
) -> Result<Launched, RrdError> {
    let engine = engine_stage(observer.as_ref(), &request.executable)?;
    if project.join(LOCATOR).is_file() {
        if let Some(view) = attach_stage(observer.as_ref(), &engine.path, project)? {
            // The proved instance was started without this desktop's mapping,
            // so attaching would silently drop it.
            if request.endpoint_credentials.is_some() {
                stage(
                    observer.as_ref(),
                    "attach",
                    "failed",
                    RUNNING_ELSEWHERE_WITH_STARTUP,
                );
                return Err(RUNNING_ELSEWHERE_WITH_STARTUP.into());
            }
            return Ok(Launched::Attached(view));
        }
    }
    serve_with(request, engine, observer).map(Launched::Owned)
}

/// Attaches to an instance another process serves for this installed
/// project. Without a record there is nothing to prove; a record that does
/// not prove itself is stale, and `rrflow serve` replaces it.
fn attach_stage(
    app: &dyn ServeObserver,
    executable: &Path,
    project: &Path,
) -> Result<Option<ServedEngramView>, RrdError> {
    if !project.join(SERVING_RECORD).is_file() {
        stage(
            app,
            "attach",
            "skipped",
            "No other process has recorded an endpoint for this project.",
        );
        return Ok(None);
    }
    stage(
        app,
        "attach",
        "running",
        "Another process recorded an endpoint for this project; proving it with the project's operator credential.",
    );
    match prove_elsewhere(executable, project) {
        Ok(Ok(view)) => {
            stage(
                app,
                "attach",
                "done",
                format!(
                    "Attached to the instance started outside Connectome at {} as {}.",
                    view.endpoint, view.instance
                ),
            );
            Ok(Some(view))
        }
        Ok(Err(reason)) => {
            stage(
                app,
                "attach",
                "skipped",
                format!("The recorded endpoint did not prove itself, so Connectome serves this project: {reason}"),
            );
            Ok(None)
        }
        Err(error) => {
            stage(app, "attach", "failed", error.message.clone());
            Err(error)
        }
    }
}

/// A known project's canonical directory, without creating anything; an
/// empty name is Connectome's own default engram.
fn known_directory(project: &str) -> Option<PathBuf> {
    let directory = match project.trim() {
        "" => get_data_directory().join(DEFAULT_ENGRAM),
        configured => PathBuf::from(configured),
    };
    if !directory.is_absolute() {
        return None;
    }
    std::fs::canonicalize(directory).ok()
}

#[tauri::command]
pub async fn rrd_engram_serve(
    app: AppHandle,
    request: EngramServeRequest,
    state: State<'_, EngramState>,
) -> Result<ServedEngramView, RrdError> {
    let owner = state.inner().clone();
    let project = request.project.clone();
    let observer: Arc<dyn ServeObserver> = Arc::new(ProjectObserver { app, project });
    tauri::async_runtime::spawn_blocking(move || owner.start(request, observer))
        .await
        .map_err(|e| RrdError::from(format!("serving task failed: {e}")))?
}

/// Prefixes the console's stage and output lines with their project.
struct ProjectObserver {
    app: AppHandle,
    project: String,
}
impl ServeObserver for ProjectObserver {
    fn stage(&self, mut value: EngramStage) {
        value.detail = format!("[{}] {}", self.project, value.detail);
        let _ = self.app.emit(STAGE_EVENT, value);
    }
    fn output(&self, line: String) {
        let _ = self
            .app
            .emit(OUTPUT_EVENT, format!("[{}] {line}", self.project));
    }
    fn lifecycle(&self, instance: InstanceView) {
        trace_lifecycle(&instance);
        let _ = self.app.emit(LIFECYCLE_EVENT, instance);
    }
}

#[tauri::command]
pub async fn rrd_engram_status(
    app: AppHandle,
    request: StatusRequest,
    state: State<'_, EngramState>,
) -> Result<StatusView, RrdError> {
    let owner = state.inner().clone();
    owner.refresh(request, Arc::new(app)).await
}

#[tauri::command]
pub async fn rrd_engram_stop(
    app: AppHandle,
    project: String,
    state: State<'_, EngramState>,
) -> Result<bool, RrdError> {
    let owner = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || owner.stop(&project, &app))
        .await
        .map_err(|e| RrdError::from(format!("stop task failed: {e}")))?
}

#[tauri::command]
pub async fn rrd_engram_forget(
    app: AppHandle,
    project: String,
    state: State<'_, EngramState>,
) -> Result<bool, RrdError> {
    let owner = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || owner.forget(&project, &app))
        .await
        .map_err(|e| RrdError::from(format!("removal task failed: {e}")))?
}

/// Shutdown marks the registry closed before dropping every owned child.
/// A launch finishing afterwards drops its child instead of publishing it.
/// Instances started elsewhere keep running.
pub fn stop_on_exit(state: &EngramState) {
    let projects = {
        let mut registry = state.lock();
        registry.closing = true;
        std::mem::take(&mut registry.projects)
    };
    drop(projects);
}

#[cfg(test)]
mod registry_tests;
