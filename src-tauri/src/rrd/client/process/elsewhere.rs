//! An instance started outside Connectome, the way a user starts `rrflow` in
//! the project folder (sprint 009, decision 19).
//!
//! The test serves the project with its own `rrflow serve` process.
//! Connectome's registry must find it through RRFlow's served endpoint
//! record, prove it with `rrflow ready --project`, attach to it, refuse to
//! stop it, notice when it stops, serve the project itself over the stale
//! record it left, and attach again after an outside restart on a new port.

use super::*;
use crate::rrd::estate::lifecycle::{InstanceState, StatusRequest};
use crate::rrd::estate::{EstateState, Origin};
use crate::rrd::RrdClientState;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, ChildStdout, Command, Stdio};

/// `rrflow serve` started by the test, not by Connectome; killed when dropped.
struct Outside {
    server: Child,
    url: String,
    // Held open so the server's stdout never breaks.
    _stdout: BufReader<ChildStdout>,
}

impl Outside {
    fn serve(project: &Path) -> Self {
        let mut server = Command::new(rrflow())
            .args(["--json", "serve", "--bind", "127.0.0.1:0", "--project"])
            .arg(project)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .expect("start rrflow serve outside Connectome");
        let mut stdout = BufReader::new(server.stdout.take().expect("piped stdout"));
        let mut line = String::new();
        stdout.read_line(&mut line).expect("the serve announcement");
        let announced: Value = serde_json::from_str(&line).expect("one JSON announcement line");
        Self {
            server,
            url: announced["url"].as_str().expect("announced URL").to_owned(),
            _stdout: stdout,
        }
    }
}

impl Drop for Outside {
    fn drop(&mut self) {
        let _ = self.server.kill();
        let _ = self.server.wait();
    }
}

#[test]
#[ignore = "drives real RRD processes: set RRFLOW_BIN and run with --ignored"]
fn an_instance_started_elsewhere_is_found_attached_and_left_running() {
    // An installed project folder, served once and killed, so it holds a
    // stale served endpoint record as a crashed server leaves one.
    let mut estate = Estate::install_and_serve();
    estate.served.server.kill().expect("kill the first server");
    estate.served.server.wait().expect("reap the first server");
    let project = estate.served.view.project.clone();
    let instance = estate.instance.clone();
    assert!(
        Path::new(&project).join(".rrflow/serving.json").is_file(),
        "a killed server leaves its record"
    );

    let observer = Arc::new(RecordingObserver::default());
    let owner = EstateState::default();
    let lines = || observer.lines.lock().expect("observer").join("\n");
    let refresh = || {
        tauri::async_runtime::block_on(owner.refresh(
            StatusRequest {
                projects: vec![project.clone()],
                executable: rrflow().to_string_lossy().into_owned(),
            },
            observer.clone(),
        ))
        .unwrap_or_else(|error| panic!("status read failed: {error:?}\n{}", lines()))
    };
    let open = || EstateServeRequest {
        project: project.clone(),
        mode: InstallMode::Existing,
        executable: rrflow().to_string_lossy().into_owned(),
        accepted_plan_sha256: None,
        installation_identity: None,
    };

    // The stale record proves nothing, and is not proved again.
    assert!(refresh().instances.is_empty(), "{}", lines());
    assert!(lines().contains("did not prove itself"), "{}", lines());
    let attempts = lines().matches("did not prove itself").count();
    assert!(refresh().instances.is_empty());
    assert_eq!(lines().matches("did not prove itself").count(), attempts);

    // Started outside Connectome: found, proved and attached.
    let outside = Outside::serve(Path::new(&project));
    let status = refresh();
    assert_eq!(status.instances.len(), 1, "{}", lines());
    let found = &status.instances[0];
    assert_eq!(found.state, InstanceState::Ready, "{}", lines());
    assert_eq!(found.origin, Origin::Elsewhere);
    let attached = found
        .estate
        .clone()
        .expect("a ready instance has coordinates");
    assert_eq!(attached.endpoint, outside.url);
    assert_eq!(attached.instance, instance);
    assert!(
        attached.engine.is_none(),
        "Connectome did not choose its engine"
    );

    // The proof is RRFlow's own report, and an instance speaking another
    // contract is refused.
    let report = std::process::Command::new(rrflow())
        .args(["--json", "ready", "--project"])
        .arg(&project)
        .output()
        .expect("rrflow ready");
    assert!(report.status.success());
    assert_eq!(
        crate::rrd::estate::proven(&report.stdout, &instance).unwrap(),
        (outside.url.clone(), instance.clone())
    );
    let mut other: Value = serde_json::from_slice(&report.stdout).unwrap();
    other["openapi"]["paths"]
        .as_object_mut()
        .expect("OpenAPI paths")
        .remove("/v1/query");
    let refused =
        crate::rrd::estate::proven(&serde_json::to_vec(&other).unwrap(), &instance).unwrap_err();
    assert!(
        refused.message.contains("different public contract"),
        "{refused:?}"
    );

    // A Connectome that has not looked yet, as one restarted while the
    // instance runs: opening the project attaches instead of failing "already
    // open in another process", and a native session reads it. Letting go of
    // an attached instance leaves it running.
    let fresh = EstateState::default();
    let opened = fresh
        .start(open(), observer.clone())
        .unwrap_or_else(|error| panic!("opening a running project failed: {error:?}\n{}", lines()));
    assert_eq!(opened.endpoint, outside.url);
    assert_eq!(opened.origin, Origin::Elsewhere);
    assert!(
        lines().contains("[attach done] Attached to the instance started outside Connectome"),
        "{}",
        lines()
    );
    drop(fresh);
    // Without the attach step the engine refuses a second serve itself, and
    // Connectome reports the engine's own reason.
    let second = serve_estate(open(), observer.clone())
        .err()
        .expect("a second serve of an open estate is refused");
    assert!(
        second.message.contains("already open in another process"),
        "{second:?}"
    );
    assert_eq!(
        owner.start(open(), observer.clone()).unwrap().endpoint,
        outside.url,
        "a registry tracking the instance returns it"
    );
    tauri::async_runtime::block_on(async {
        let sessions = RrdClientState::default();
        sessions
            .connect(
                "outside".into(),
                RrdConnectRequest {
                    endpoint: opened.endpoint.clone(),
                    instance: opened.instance.clone(),
                    credential_path: opened.credential_path.clone(),
                },
            )
            .await
            .expect("a native session on the attached instance");
        sessions
            .client("outside")
            .await
            .unwrap()
            .database()
            .await
            .expect("the attached instance reads");
        sessions.disconnect("outside").await.unwrap();
    });

    // Connectome never stops it, and it keeps answering.
    let refusal = owner.stop(&project, observer.as_ref()).unwrap_err();
    assert!(
        refusal.message.contains("outside Connectome"),
        "{refusal:?}"
    );
    assert_eq!(refresh().instances[0].state, InstanceState::Ready);

    // Stopped outside: the next status read says so.
    let lost = outside.url.clone();
    drop(outside);
    assert!(refresh().instances.is_empty(), "{}", lines());
    assert!(
        lines().contains(&format!("no longer answers at {lost}")),
        "{}",
        lines()
    );

    // Connectome serves the project itself over the record the killed
    // server left. The engine is the registry's, so dropping the registry
    // stops it, although its console thread still holds the start's observer.
    let serving = EstateState::default();
    let served = serving
        .start(open(), observer.clone())
        .unwrap_or_else(|error| {
            panic!("serving over a stale record failed: {error:?}\n{}", lines())
        });
    assert_eq!(served.origin, Origin::Connectome);
    assert_eq!(served.instance, instance);
    assert!(
        lines().contains("[attach skipped] The recorded endpoint did not prove itself"),
        "{}",
        lines()
    );
    let answers =
        |endpoint: &str| tauri::async_runtime::block_on(answers_as(endpoint, &instance)).is_ok();
    assert!(answers(&served.endpoint));
    drop(serving);
    assert!(
        !answers(&served.endpoint),
        "dropping the registry stops the engine it owns"
    );

    // Restarted outside on a new port: attached again.
    let restarted = Outside::serve(Path::new(&project));
    let status = refresh();
    assert_eq!(status.instances.len(), 1, "{}", lines());
    assert_eq!(status.instances[0].state, InstanceState::Ready);
    assert_eq!(
        status.instances[0].estate.as_ref().unwrap().endpoint,
        restarted.url
    );
    drop(restarted);
}
