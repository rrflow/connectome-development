//! Lost engine replies preserve exact command recovery.
use super::super::reply_dropper::ReplyDropper;
use super::*;

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn project_plan_controls_reconcile_lost_replies_without_duplicate_effects() {
    let engram = Engram::install_and_serve();
    let proxy = ReplyDropper::new(engram.address);
    tauri::async_runtime::block_on(async {
        let request = || {
            let mut request = engram.connect_request();
            request.endpoint = format!("http://{}", proxy.address);
            request
        };
        let client = NativeRrdClient::connect(request()).await.unwrap();
        let Reply::Page { page } = client
            .attunement_command(Command::List { after_job_id: None })
            .await
            .unwrap()
        else {
            panic!("page")
        };
        let id = page["jobs"][0]["job_id"].as_str().unwrap();
        let initial = read(&client, id).await;
        let (handle, key) = prepare(
            &client,
            &initial,
            Control::Start {
                lease_ms: "60000".into(),
            },
        )
        .await;
        let start_path = "/v1/attunement/start";
        proxy.drop_next(start_path);
        assert!(matches!(
            client
                .attunement_command(Command::Approve {
                    handle: handle.clone()
                })
                .await
                .unwrap(),
            Reply::Uncertain { .. }
        ));
        assert_eq!(proxy.count(start_path), 1, "no automatic retry");
        let Reply::Pending {
            prepared: Some(pending),
        } = client.attunement_command(Command::Pending).await.unwrap()
        else {
            panic!("native recovery preview")
        };
        assert_eq!(pending["handle"], handle);
        assert_eq!(pending["idempotency_key"], key);
        assert!(client
            .attunement_command(Command::Discard {
                handle: handle.clone()
            })
            .await
            .is_err());
        assert!(
            client
                .attunement_command(Command::Prepare {
                    job_id: id.into(),
                    expected_revision: "1".into(),
                    plan_sha256: initial["plan"]["plan_sha256"].as_str().unwrap().into(),
                    command: Control::Replan,
                })
                .await
                .is_err(),
            "unresolved commands cannot be overwritten"
        );
        let started = approve(&client, handle).await;
        assert_eq!(proxy.count(start_path), 2, "only explicit same-key retry");
        assert_eq!(
            started["status"]["job"]["revision"], "2",
            "replay did not transition twice"
        );
        assert_eq!(
            read(&client, id).await["status"]["job"],
            started["status"]["job"]
        );
        std::fs::write(
            PathBuf::from(&engram.served.view.project).join("lost-reply-fixture.txt"),
            "Source change in a temporary integration-test project.\n",
        )
        .unwrap();
        let (handle, key) = prepare(&client, &started, Control::Replan).await;
        let accept_path = "/v1/attunement/replan/accept";
        proxy.drop_next(accept_path);
        assert!(matches!(
            client
                .attunement_command(Command::Approve { handle })
                .await
                .unwrap(),
            Reply::Uncertain { .. }
        ));
        assert_eq!(proxy.count(accept_path), 1);
        client.close().await.unwrap();
        let reopened = NativeRrdClient::connect(request()).await.unwrap();
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
            panic!("recover committed replan")
        };
        let successor_id = receipt["status"]["job"]["id"].as_str().unwrap();
        assert_ne!(successor_id, id);
        assert_eq!(receipt["status"]["job"]["state"], "pending");
        assert_eq!(
            read(&reopened, successor_id).await["status"]["job"],
            receipt["status"]["job"]
        );
        assert_eq!(
            proxy.count(accept_path),
            1,
            "receipt recovery never resubmits acceptance"
        );
        reopened.close().await.unwrap();
    });
}
