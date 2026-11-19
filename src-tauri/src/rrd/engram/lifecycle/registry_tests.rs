//! The registry without an engine: what it tracks, numbers, sends and forgets.

use super::*;
use crate::rrd::engram::InstallMode;
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Default)]
struct Recording(Mutex<Vec<InstanceView>>);
impl ServeObserver for Recording {
    fn stage(&self, _: EngramStage) {}
    fn output(&self, _: String) {}
    fn lifecycle(&self, instance: InstanceView) {
        self.0.lock().unwrap().push(instance);
    }
}
impl Recording {
    fn states(&self) -> Vec<(InstanceState, Option<&'static str>)> {
        self.0
            .lock()
            .unwrap()
            .iter()
            .map(|view| (view.state, view.stage))
            .collect()
    }
}

fn scratch(label: &str) -> PathBuf {
    let directory = std::env::temp_dir().join(format!(
        "connectome-{label}-{}",
        uuid::Uuid::new_v4().simple()
    ));
    std::fs::create_dir_all(&directory).unwrap();
    std::fs::canonicalize(&directory).unwrap()
}

fn request(directory: &Path) -> EngramServeRequest {
    EngramServeRequest {
        project: directory.to_string_lossy().into_owned(),
        mode: Some(InstallMode::Fresh),
        executable: directory
            .join("missing-engine")
            .to_string_lossy()
            .into_owned(),
        accepted_plan_sha256: None,
        installation_identity: None,
        endpoint_credentials: None,
    }
}

fn starting(origin: Origin) -> Entry {
    Entry::Starting {
        origin,
        stage: None,
        detail: String::new(),
    }
}

fn attached(project: &Path, endpoint: &str) -> ServedEngramView {
    ServedEngramView {
        project: project.to_string_lossy().into_owned(),
        endpoint: endpoint.into(),
        instance: "instance-elsewhere".into(),
        credential_path: project
            .join(".rrflow/credentials/local-operator.json")
            .to_string_lossy()
            .into_owned(),
        installed: false,
        origin: Origin::Elsewhere,
        engine: None,
        endpoint_credentials: None,
    }
}

/// More projects than any limit this registry once had: four engines,
/// eight tracked instances, sixty-four known projects.
const MANY: usize = 70;

#[test]
fn every_project_keeps_its_place_however_many_are_tracked() {
    let directory = scratch("many");
    let owner = EngramState::default();
    let quiet = Arc::new(Recording::default());
    for index in 0..MANY {
        let (running, failed) = (format!("running-{index}"), format!("failed-{index}"));
        let mut registry = owner.lock();
        registry.set(&directory.join(running), starting(Origin::Connectome));
        registry.set(
            &directory.join(failed),
            Entry::Failed {
                origin: Origin::Connectome,
                stage: "serve",
                detail: String::new(),
            },
        );
    }
    assert!(owner.start(request(&directory), quiet).is_err());
    let status = owner.status();
    let started = status
        .instances
        .iter()
        .find(|instance| Path::new(&instance.project) == directory)
        .expect("one more start is admitted");
    assert_eq!(
        (started.state, started.stage),
        (InstanceState::Failed, Some("engine")),
        "it gets as far as resolving its engine"
    );
    let count = |state| status.instances.iter().filter(|i| i.state == state).count();
    assert_eq!(count(InstanceState::Starting), MANY);
    assert_eq!(
        count(InstanceState::Failed),
        MANY + 1,
        "no failure gives up its place to another project"
    );
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn a_status_read_proves_and_attaches_every_known_project() {
    let directory = scratch("known");
    let projects: Vec<PathBuf> = (0..MANY)
        .map(|index| directory.join(index.to_string()))
        .collect();
    for project in &projects {
        std::fs::create_dir_all(project.join(".rrflow")).unwrap();
        std::fs::write(project.join(SERVING_RECORD), "recorded").unwrap();
    }
    let owner = EngramState::default();
    let prover: Arc<Prover> =
        Arc::new(|_, project| Ok(Ok(attached(project, "http://127.0.0.1:9"))));
    let status = tauri::async_runtime::block_on(
        owner.refresh_with(
            StatusRequest {
                projects: projects
                    .iter()
                    .map(|project| project.to_string_lossy().into_owned())
                    .collect(),
                executable: String::new(),
            },
            Arc::new(Recording::default()),
            prover,
        ),
    )
    .unwrap();
    assert_eq!(status.instances.len(), MANY);
    assert!(status
        .instances
        .iter()
        .all(|i| i.state == InstanceState::Ready && i.origin == Origin::Elsewhere));
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn a_pending_start_is_reserved_and_its_failure_is_kept() {
    let directory = scratch("registry");
    let owner = EngramState::default();
    let quiet = Arc::new(Recording::default());
    let start = || owner.start(request(&directory), quiet.clone());
    owner.lock().set(&directory, starting(Origin::Connectome));
    assert!(start().unwrap_err().message.contains("already starting"));
    assert!(owner
        .stop(directory.to_str().unwrap(), quiet.as_ref())
        .unwrap_err()
        .message
        .contains("still running"));
    drop(Reservation(owner.clone(), directory.clone()));
    assert!(owner.status().instances.is_empty());
    assert!(start().is_err(), "an absent executable cannot start");
    let status = owner.status();
    assert_eq!(status.instances.len(), 1, "the failure is kept");
    assert_eq!(status.instances[0].state, InstanceState::Failed);
    assert_eq!(status.instances[0].stage, Some("engine"));
    // Read from the registry itself, not from the view a failure would give
    // in any case: no entry may still own a child, or be stopping one.
    assert!(
        owner
            .lock()
            .projects
            .values()
            .all(|tracked| matches!(tracked.entry, Entry::Failed { .. })),
        "a failure holds no engine"
    );
    owner.lock().closing = true;
    assert!(start().unwrap_err().message.contains("shutting down"));
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn every_transition_is_numbered_and_sent() {
    let directory = scratch("transitions");
    let owner = EngramState::default();
    let recording = Arc::new(Recording::default());
    assert!(owner.start(request(&directory), recording.clone()).is_err());
    assert_eq!(
        recording.states(),
        [
            (InstanceState::Starting, None),
            (InstanceState::Starting, Some("engine")),
            (InstanceState::Failed, Some("engine")),
        ],
        "a start reports the stage it reached, then where it failed"
    );
    assert!(owner.start(request(&directory), recording.clone()).is_err());
    assert_eq!(owner.status().instances.len(), 1, "a new start replaces it");
    assert!(!owner
        .stop(directory.to_str().unwrap(), recording.as_ref())
        .unwrap());
    assert!(
        owner.status().instances.is_empty(),
        "stop dismisses a failure"
    );
    let views = recording.0.lock().unwrap();
    assert_eq!(views.last().unwrap().state, InstanceState::Stopped);
    assert!(
        views
            .windows(2)
            .all(|pair| pair[0].revision < pair[1].revision),
        "transitions are numbered in order"
    );
    assert_eq!(owner.status().revision, views.last().unwrap().revision);
    drop(views);
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn an_instance_started_elsewhere_is_attached_never_stopped() {
    let directory = scratch("elsewhere");
    let owner = EngramState::default();
    let recording = Arc::new(Recording::default());
    let view = attached(&directory, "http://127.0.0.1:9");
    owner.lock().set(&directory, Entry::Attached(view.clone()));
    assert_eq!(
        owner
            .start(request(&directory), recording.clone())
            .unwrap()
            .endpoint,
        view.endpoint,
        "opening it returns the attached instance"
    );
    let refusal = owner
        .stop(directory.to_str().unwrap(), recording.as_ref())
        .unwrap_err();
    assert!(refusal.message.contains("outside Connectome"));
    assert_eq!(owner.status().instances[0].state, InstanceState::Ready);
    assert_eq!(owner.status().instances[0].origin, Origin::Elsewhere);
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn a_removed_project_is_forgotten_and_one_started_elsewhere_keeps_running() {
    let directory = scratch("forgotten");
    std::fs::create_dir_all(directory.join(".rrflow")).unwrap();
    std::fs::write(directory.join(SERVING_RECORD), "recorded").unwrap();
    let project = directory.to_str().unwrap();
    let owner = EngramState::default();
    let recording = Arc::new(Recording::default());
    owner.lock().set(
        &directory,
        Entry::Attached(attached(&directory, "http://127.0.0.1:9")),
    );
    assert!(
        !owner.forget(project, recording.as_ref()).unwrap(),
        "no engine is stopped for an instance started elsewhere"
    );
    assert!(owner.status().instances.is_empty());
    let last = recording.0.lock().unwrap().last().cloned().unwrap();
    assert_eq!(last.state, InstanceState::Stopped);
    assert_eq!(last.detail, FORGOTTEN_ELSEWHERE);
    // A status read that still names the project does not attach it again.
    let prover: Arc<Prover> = Arc::new(|_, _| panic!("a forgotten record is not proved"));
    let status = tauri::async_runtime::block_on(owner.refresh_with(
        StatusRequest {
            projects: vec![project.to_owned()],
            executable: String::new(),
        },
        recording.clone(),
        prover,
    ))
    .unwrap();
    assert!(status.instances.is_empty());
    // Removing a failed project dismisses it; a start in flight is refused.
    assert!(owner.start(request(&directory), recording.clone()).is_err());
    assert!(!owner.forget(project, recording.as_ref()).unwrap());
    assert!(owner.status().instances.is_empty());
    owner.lock().set(&directory, starting(Origin::Connectome));
    assert!(owner.forget(project, recording.as_ref()).is_err());
    assert!(
        directory.join(SERVING_RECORD).is_file(),
        "the project's files are left as they are"
    );
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn a_running_instance_never_takes_a_startup_mapping() {
    let directory = scratch("mapped");
    let mapping = directory.join("mapping.json");
    std::fs::write(&mapping, "{\"format_version\":1,\"entries\":[]}").unwrap();
    let owner = EngramState::default();
    let recording = Arc::new(Recording::default());
    let view = attached(&directory, "http://127.0.0.1:9");
    owner.lock().set(&directory, Entry::Attached(view.clone()));
    let mut mapped = request(&directory);
    mapped.endpoint_credentials = Some(mapping.to_string_lossy().into_owned());
    let refusal = owner.start(mapped, recording.clone()).unwrap_err();
    assert!(refusal.message.contains("stop it where it was started"));
    assert_eq!(
        owner
            .start(request(&directory), recording.clone())
            .unwrap()
            .endpoint,
        view.endpoint,
        "opening it without a mapping still returns the attached instance"
    );
    let mut relative = request(&directory);
    relative.endpoint_credentials = Some("mapping.json".into());
    assert!(owner
        .start(relative, recording)
        .unwrap_err()
        .message
        .contains("absolute"));
    assert_eq!(owner.status().instances[0].state, InstanceState::Ready);
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn a_lost_instance_is_stopped_and_a_stale_record_is_proved_once() {
    let directory = scratch("discovery");
    let lost = scratch("lost");
    std::fs::create_dir_all(directory.join(".rrflow")).unwrap();
    std::fs::write(directory.join(SERVING_RECORD), "stale").unwrap();
    let port = {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.local_addr().unwrap().port()
    };
    let owner = EngramState::default();
    owner.lock().set(
        &lost,
        Entry::Attached(attached(&lost, &format!("http://127.0.0.1:{port}"))),
    );
    let recording = Arc::new(Recording::default());
    let calls = Arc::new(AtomicUsize::new(0));
    let prover = {
        let calls = Arc::clone(&calls);
        let directory = directory.clone();
        Arc::new(move |_: &str, project: &Path| {
            calls.fetch_add(1, Ordering::SeqCst);
            Ok(if calls.load(Ordering::SeqCst) < 3 {
                Err("connection refused".to_owned())
            } else {
                Ok(attached(project, "http://127.0.0.1:9"))
            })
            .inspect(|_| assert_eq!(project, directory))
        })
    };
    let refresh = || {
        tauri::async_runtime::block_on(owner.refresh_with(
            StatusRequest {
                projects: vec![directory.to_string_lossy().into_owned()],
                executable: String::new(),
            },
            recording.clone(),
            prover.clone(),
        ))
        .unwrap()
    };
    let first = refresh();
    assert!(
        first.instances.is_empty(),
        "nothing answers or proves itself"
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    let detail = |state: InstanceState| {
        recording
            .0
            .lock()
            .unwrap()
            .iter()
            .filter(|view| view.state == state)
            .map(|view| view.detail.clone())
            .collect::<Vec<_>>()
    };
    let stopped = detail(InstanceState::Stopped);
    assert!(stopped
        .iter()
        .any(|detail| detail.contains("no longer answers")));
    assert!(stopped
        .iter()
        .any(|detail| detail.contains("did not prove itself")));
    refresh();
    assert_eq!(
        calls.load(Ordering::SeqCst),
        1,
        "the same record is proved once"
    );
    std::fs::write(directory.join(SERVING_RECORD), "a newer record").unwrap();
    refresh();
    assert_eq!(
        calls.load(Ordering::SeqCst),
        2,
        "a changed record is proved"
    );
    std::fs::write(directory.join(SERVING_RECORD), "the newest record").unwrap();
    let attached = refresh();
    assert_eq!(calls.load(Ordering::SeqCst), 3);
    assert_eq!(attached.instances.len(), 1);
    assert_eq!(attached.instances[0].state, InstanceState::Ready);
    assert_eq!(attached.instances[0].origin, Origin::Elsewhere);
    std::fs::remove_dir_all(directory).unwrap();
    std::fs::remove_dir_all(lost).unwrap();
}
