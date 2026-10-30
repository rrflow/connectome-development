//! Actual engine startup configuration; no provider, model output or training data.
use super::*;
use crate::rrd::estate::EstateState;

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn endpoint_mapping_is_engine_validated_and_requires_explicit_restart() {
    let root = std::env::temp_dir().join(format!("connectome-startup-{}", Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let mapping = root.join("mapping with spaces.json");
    let empty_mapping = br#"{"format_version":1,"entries":[]}"#;
    std::fs::write(&mapping, empty_mapping).unwrap();
    let request = accepted(EstateServeRequest {
        project: root.join("project").to_string_lossy().into_owned(),
        mode: InstallMode::Fresh,
        executable: rrflow().to_string_lossy().into_owned(),
        accepted_plan_sha256: None,
        installation_identity: None,
        endpoint_credentials: Some(mapping.to_string_lossy().into_owned()),
    });
    let observer = Arc::new(RecordingObserver::default());
    let owner = EstateState::default();
    let first = owner.start(request.clone(), observer.clone()).unwrap();
    assert_eq!(
        first.endpoint_credentials.as_deref(),
        mapping.canonicalize().unwrap().to_str()
    );
    assert!(owner
        .start(request.clone(), observer.clone())
        .unwrap_err()
        .message
        .contains("stop"));
    let mut without_mapping = request.clone();
    without_mapping.endpoint_credentials = None;
    assert!(owner
        .start(without_mapping.clone(), observer.clone())
        .unwrap_err()
        .message
        .contains("stop"));
    assert_eq!(owner.status().unwrap().len(), 1);
    assert!(owner.stop(&first.project).unwrap());

    // The native launcher does not parse or repair mapping contents. The real
    // engine must reject this; ignoring the argument would incorrectly serve.
    std::fs::write(&mapping, b"not-json").unwrap();
    assert!(owner.start(request.clone(), observer.clone()).is_err());
    assert!(
        owner.status().unwrap().is_empty(),
        "failed start releases its reservation"
    );
    std::fs::write(&mapping, empty_mapping).unwrap();
    let reopened = owner.start(request.clone(), observer.clone()).unwrap();
    assert_eq!(reopened.instance, first.instance);
    assert!(!reopened.installed);
    assert!(owner.stop(&reopened.project).unwrap());

    let unconfigured = owner.start(without_mapping, observer.clone()).unwrap();
    assert!(unconfigured.endpoint_credentials.is_none());
    assert!(owner
        .start(request, observer)
        .unwrap_err()
        .message
        .contains("stop"));
    assert!(owner.stop(&unconfigured.project).unwrap());
    drop(owner);
    std::fs::remove_dir_all(root).unwrap();
}
