//! Real installed engine tests. Temporary source files are test fixtures, never learning data.
use super::*;
mod lost_reply;
use crate::rrd::client::attunement::{
    AttunementCommand as Command, AttunementReply as Reply, Control,
};

async fn read(client: &NativeRrdClient, id: &str) -> Value {
    let Reply::Snapshot { snapshot } = client
        .attunement_command(Command::Read { job_id: id.into() })
        .await
        .unwrap()
    else {
        panic!("stored snapshot")
    };
    snapshot
}

async fn prepare(client: &NativeRrdClient, state: &Value, command: Control) -> (String, String) {
    let Reply::Prepared {
        handle,
        idempotency_key,
        ..
    } = client
        .attunement_command(Command::Prepare {
            job_id: state["status"]["job"]["id"].as_str().unwrap().into(),
            expected_revision: state["status"]["job"]["revision"].as_str().unwrap().into(),
            plan_sha256: state["plan"]["plan_sha256"].as_str().unwrap().into(),
            command,
        })
        .await
        .unwrap()
    else {
        panic!("prepared command")
    };
    (handle, idempotency_key)
}

async fn approve(client: &NativeRrdClient, handle: String) -> Value {
    let reply = client
        .attunement_command(Command::Approve { handle })
        .await
        .unwrap();
    let Reply::Applied { snapshot } = reply else {
        panic!("accepted command: {reply:?}")
    };
    snapshot
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn project_plan_controls_recover_expired_lease_and_record_cancellation() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .unwrap();
        let Reply::Page { page } = client
            .attunement_command(Command::List { after_job_id: None })
            .await
            .unwrap()
        else {
            panic!("page")
        };
        let id = page["jobs"][0]["job_id"].as_str().unwrap();
        let initial = read(&client, id).await;
        let (discarded, _) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "10000".into(),
            },
        )
        .await;
        assert!(matches!(
            client
                .attunement_command(Command::Discard {
                    handle: discarded.clone()
                })
                .await
                .unwrap(),
            Reply::Discarded
        ));
        assert!(client
            .attunement_command(Command::Approve { handle: discarded })
            .await
            .is_err());
        assert_eq!(
            read(&client, id).await["status"]["job"],
            initial["status"]["job"]
        );
        let (handle, _) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "10000".into(),
            },
        )
        .await;
        let started = approve(&client, handle).await;
        // Expiry is an actual engine wall-clock transition, not an invented state.
        let expires: u64 = started["status"]["job"]["lease"]["expires_at_unix_ms"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap();
        let wait_ms = expires
            .saturating_sub(now_unix_ms().unwrap())
            .saturating_add(20);
        assert!(wait_ms <= 10_020);
        std::thread::sleep(Duration::from_millis(wait_ms));
        let (handle, _) = prepare(&client, &started, Control::RecoverExpired).await;
        let recovered = approve(&client, handle).await;
        assert_eq!(recovered["status"]["job"]["state"], "paused");
        assert!(recovered["status"]["job"]["lease"].is_null());
        assert!(
            client
                .attunement_command(Command::Prepare {
                    job_id: id.into(),
                    expected_revision: initial["status"]["job"]["revision"]
                        .as_str()
                        .unwrap()
                        .into(),
                    plan_sha256: initial["plan"]["plan_sha256"].as_str().unwrap().into(),
                    command: Control::Cancel {
                        reason: "Close the temporary process-test job".into()
                    },
                })
                .await
                .is_err(),
            "stale displayed revision is never silently upgraded"
        );
        let (handle, key) = prepare(
            &client,
            &recovered,
            Control::Cancel {
                reason: "Close the temporary process-test job".into(),
            },
        )
        .await;
        let cancelled = approve(&client, handle).await;
        assert_eq!(cancelled["status"]["job"]["state"], "cancel_requested");
        let Reply::Receipt {
            snapshot: Some(receipt),
        } = client
            .attunement_command(Command::Receipt {
                job_id: id.into(),
                idempotency_key: key,
                replan: false,
            })
            .await
            .unwrap()
        else {
            panic!("cancellation receipt")
        };
        assert_eq!(receipt["status"]["job"], cancelled["status"]["job"]);
        client.close().await.unwrap();
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn project_plan_controls_discover_replan_and_recover_without_client_identity_derivation() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .unwrap();
        let Reply::Page { page } = client
            .attunement_command(Command::List { after_job_id: None })
            .await
            .unwrap()
        else {
            panic!("job page")
        };
        assert_eq!(page["jobs"].as_array().unwrap().len(), 1);
        let id = page["jobs"][0]["job_id"].as_str().unwrap();
        let initial = read(&client, id).await;
        assert_eq!(initial["status"]["job"]["state"], "pending");
        assert_eq!(initial["source_verification"], "not_checked");
        assert!(client
            .attunement_command(Command::Read {
                job_id: "foreign-job".into()
            })
            .await
            .is_err());
        let (handle, _) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        assert!(client
            .attunement_command(Command::Approve {
                handle: "unreviewed-handle".into()
            })
            .await
            .is_err());
        assert_eq!(
            read(&client, id).await["status"]["job"],
            initial["status"]["job"],
            "preparation and invalid approval cannot advance the job"
        );
        client.refresh_now(true).await.unwrap();
        assert!(
            matches!(
                client
                    .attunement_command(Command::Approve { handle })
                    .await
                    .unwrap(),
                Reply::Denied { .. }
            ),
            "a different session cannot approve the preview"
        );
        let (handle, key) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let started = approve(&client, handle.clone()).await;
        assert_eq!(started["status"]["job"]["state"], "running");
        assert!(
            client
                .attunement_command(Command::Approve { handle })
                .await
                .is_err(),
            "consumed approval cannot advance twice"
        );
        let Reply::Receipt {
            snapshot: Some(receipt),
        } = client
            .attunement_command(Command::Receipt {
                job_id: id.into(),
                idempotency_key: key,
                replan: false,
            })
            .await
            .unwrap()
        else {
            panic!("start receipt")
        };
        assert_eq!(receipt["status"]["job"], started["status"]["job"]);

        let (handle, _) = prepare(&client, &started, Control::Step).await;
        let connected = approve(&client, handle).await;
        assert_eq!(
            connected["status"]["job"]["checkpoints"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        let (handle, _) = prepare(&client, &connected, Control::Pause).await;
        let paused = approve(&client, handle).await;
        assert_eq!(paused["status"]["job"]["state"], "paused");
        let (handle, _) = prepare(
            &client,
            &paused,
            Control::Resume {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let resumed = approve(&client, handle).await;
        assert_eq!(
            resumed["status"]["job"]["checkpoints"],
            connected["status"]["job"]["checkpoints"]
        );

        let source = PathBuf::from(&estate.served.view.project).join("plan-control-fixture.txt");
        std::fs::write(
            &source,
            "Ordinary source edit used only by this installed-process test.\n",
        )
        .unwrap();
        let changed = read(&client, id).await;
        assert_eq!(
            changed["plan"], initial["plan"],
            "stored reads do not silently replan"
        );
        let (stale_handle, _) = prepare(&client, &changed, Control::Replan).await;
        std::fs::write(
            &source,
            "A second edit invalidates the pending source preview.\n",
        )
        .unwrap();
        let rejected = client
            .attunement_command(Command::Approve {
                handle: stale_handle,
            })
            .await
            .unwrap();
        assert!(
            matches!(rejected, Reply::Denied { .. }),
            "stale source must be denied: {rejected:?}"
        );
        assert_eq!(
            read(&client, id).await["status"]["job"],
            resumed["status"]["job"]
        );
        let (handle, key) = prepare(&client, &changed, Control::Replan).await;
        let successor = approve(&client, handle).await;
        let successor_id = successor["status"]["job"]["id"].as_str().unwrap();
        assert_ne!(successor_id, id);
        assert_ne!(
            successor["plan"]["source_sha256"],
            initial["plan"]["source_sha256"]
        );
        assert_eq!(successor["status"]["job"]["state"], "pending");
        assert_eq!(
            read(&client, id).await["status"]["job"]["state"],
            "cancel_requested"
        );
        client.close().await.unwrap();

        let reopened = NativeRrdClient::connect(estate.connect_request())
            .await
            .unwrap();
        let Reply::Page { page } = reopened
            .attunement_command(Command::List { after_job_id: None })
            .await
            .unwrap()
        else {
            panic!("reopened page")
        };
        assert_eq!(page["jobs"].as_array().unwrap().len(), 2);
        assert_eq!(page["jobs"][1]["job_id"], successor_id);
        let Reply::Page { page } = reopened
            .attunement_command(Command::List {
                after_job_id: Some(id.into()),
            })
            .await
            .unwrap()
        else {
            panic!("continuation page")
        };
        assert_eq!(page["jobs"].as_array().unwrap().len(), 1);
        assert_eq!(page["jobs"][0]["job_id"], successor_id);
        let Reply::Receipt {
            snapshot: Some(receipt),
        } = reopened
            .attunement_command(Command::Receipt {
                job_id: id.into(),
                idempotency_key: key,
                replan: true,
            })
            .await
            .unwrap()
        else {
            panic!("replan receipt after reconnect")
        };
        assert_eq!(receipt["status"]["job"], successor["status"]["job"]);
        assert_eq!(
            read(&reopened, successor_id).await["status"]["job"],
            successor["status"]["job"]
        );
        reopened.close().await.unwrap();
    });
}
