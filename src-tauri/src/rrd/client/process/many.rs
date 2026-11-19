//! Many projects at once, and the installation mode a folder calls for.
//!
//! Connectome puts no number on the projects it runs: each start is its own
//! task and its own engine process. The first test starts more engines at the
//! same time than the registry once admitted (four) and removes one while the
//! rest keep running. The second adds a folder that already holds a file
//! without naming a mode, as the Add project action does.

use super::*;
use crate::rrd::engram::lifecycle::InstanceState;
use crate::rrd::engram::EngramState;

/// One more than the four engines the registry once refused to exceed.
const ENGINES: usize = 5;

fn project(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "connectome-many-{label}-{}",
        Uuid::new_v4().simple()
    ))
}

fn unstated(project: &std::path::Path) -> EngramServeRequest {
    EngramServeRequest {
        project: project.to_string_lossy().into_owned(),
        mode: None,
        executable: rrflow().to_string_lossy().into_owned(),
        accepted_plan_sha256: None,
        installation_identity: None,
        endpoint_credentials: None,
    }
}

#[test]
#[ignore = "drives real RRD processes: set RRFLOW_BIN and run with --ignored"]
fn more_engines_than_the_old_limit_start_at_once_and_one_is_removed_alone() {
    let owner = EngramState::default();
    let observer = Arc::new(RecordingObserver::default());
    let requests: Vec<_> = (0..ENGINES)
        .map(|index| accepted(unstated(&project(&index.to_string()))))
        .collect();
    let served: Vec<_> = std::thread::scope(|scope| {
        let starts: Vec<_> = requests
            .iter()
            .map(|request| {
                let (owner, observer) = (owner.clone(), observer.clone());
                scope.spawn(move || owner.start(request.clone(), observer))
            })
            .collect();
        starts
            .into_iter()
            .map(|start| start.join().expect("start thread"))
            .collect()
    });
    let lines = || observer.lines.lock().expect("observer").join("\n");
    let served: Vec<_> = served
        .into_iter()
        .map(|result| result.unwrap_or_else(|error| panic!("{}\n{}", error.message, lines())))
        .collect();
    let status = owner.status();
    assert_eq!(status.instances.len(), ENGINES);
    assert!(status
        .instances
        .iter()
        .all(|instance| instance.state == InstanceState::Ready));
    let endpoints: std::collections::BTreeSet<_> =
        served.iter().map(|engram| &engram.endpoint).collect();
    assert_eq!(endpoints.len(), ENGINES, "every project has its own engine");

    // Removing one project stops its engine and leaves its files and the others.
    assert!(owner.forget(&served[0].project, observer.as_ref()).unwrap());
    assert!(
        PathBuf::from(&served[0].project)
            .join(".rrflow/config.toml")
            .is_file(),
        "removing a project from Connectome deletes none of its files"
    );
    assert_eq!(owner.status().instances.len(), ENGINES - 1);
    for engram in &served[1..] {
        assert!(owner.stop(&engram.project, observer.as_ref()).unwrap());
    }
    assert!(owner.status().instances.is_empty());
    for request in requests {
        std::fs::remove_dir_all(request.project).expect("remove test-owned project");
    }
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn a_folder_that_holds_files_is_installed_as_existing_without_being_asked() {
    let empty = project("empty");
    let preview = preview_engram(&unstated(&empty)).expect("an absent folder is planned");
    assert_eq!(preview.mode, Some(InstallMode::Fresh));

    let holding = project("holding");
    std::fs::create_dir_all(&holding).unwrap();
    std::fs::write(holding.join("notes.txt"), "the project's own file").unwrap();
    let request = unstated(&holding);
    let preview = preview_engram(&request).expect("a folder with files is planned");
    assert_eq!(preview.mode, Some(InstallMode::Existing));
    assert!(preview.installation.is_some());

    // Applied with the mode the preview states, as the desktop does.
    let mut request = accepted(request);
    request.mode = preview.mode;
    let observer = Arc::new(RecordingObserver::default());
    let mut served = serve_engram(request, observer).expect("the existing folder installs");
    assert!(served.view.installed);
    served.server.kill().unwrap();
    served.server.wait().unwrap();
    assert_eq!(
        std::fs::read_to_string(holding.join("notes.txt")).unwrap(),
        "the project's own file"
    );
    assert_eq!(
        preview_engram(&unstated(&holding)).unwrap().mode,
        None,
        "an installed project is opened, not planned again"
    );
    std::fs::remove_dir_all(empty).unwrap();
    std::fs::remove_dir_all(holding).unwrap();
}
