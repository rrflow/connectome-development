//! Actual native approval, live query admission, isolation and restart.
use super::*;
use crate::rrd::client::configuration::{
    ConfigurationCommand as Command, ConfigurationReply as Reply,
};

async fn read(client: &NativeRrdClient) -> (Value, Option<Value>) {
    let Reply::Snapshot {
        project,
        effective,
        effective_error,
    } = client.configuration_command(Command::Read).await.unwrap()
    else {
        panic!("snapshot")
    };
    assert!(effective_error.is_none(), "{effective_error:?}");
    (project, effective)
}

async fn prepare(client: &NativeRrdClient, revision: &str, rows: &str) -> (String, Value) {
    let request = serde_json::from_value(json!({
        "action":"prepare", "expected_revision":revision,
        "settings":{"query_rows":{"minimum":null,"maximum":rows,"preference":rows},
                    "query_batch_rows":{"minimum":null,"maximum":rows,"preference":rows}}
    }))
    .unwrap();
    let Reply::Prepared { handle, plan, .. } = client.configuration_command(request).await.unwrap()
    else {
        panic!("preview")
    };
    (handle, plan)
}

const QUERY: &str = "FROM record:document AT VALID 100 KNOWN HEAD PROJECT * LIMIT 1";

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn project_policy_controls_reconcile_lost_reply_without_replaying() {
    use super::reply_dropper::ReplyDropper;
    let engram = Engram::install_and_serve();
    let proxy = ReplyDropper::new(engram.address);
    tauri::async_runtime::block_on(async {
        let mut request = engram.connect_request();
        request.endpoint = format!("http://{}", proxy.address);
        let client = NativeRrdClient::connect(request).await.unwrap();
        let (handle, plan) = prepare(&client, "0", "2").await;
        let path = "/v1/configuration/project/apply";
        proxy.drop_next(path);
        assert!(matches!(
            client
                .configuration_command(Command::Approve {
                    handle: handle.clone()
                })
                .await
                .unwrap(),
            Reply::Uncertain { .. }
        ));
        assert_eq!(proxy.count(path), 1);
        assert!(client
            .configuration_command(Command::Discard {
                handle: handle.clone()
            })
            .await
            .is_err());
        let (stored, _) = read(&client).await;
        assert_eq!(stored["head"]["applied_plan_sha256"], plan["plan_sha256"]);
        assert!(matches!(
            client
                .configuration_command(Command::Pending)
                .await
                .unwrap(),
            Reply::Pending { prepared: None }
        ));
        assert_eq!(proxy.count(path), 1, "readback never repeats apply");
        let (next, _) = prepare(&client, "1", "3").await;
        client
            .configuration_command(Command::Discard { handle: next })
            .await
            .unwrap();
        client.close().await.unwrap();
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn project_policy_controls_govern_live_queries_and_survive_restart() {
    let mut engram = Engram::install_and_serve();
    let other = Engram::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&engram).await;
        let client = NativeRrdClient::connect(engram.connect_request())
            .await
            .unwrap();
        let competing = NativeRrdClient::connect(engram.connect_request())
            .await
            .unwrap();
        let isolated = NativeRrdClient::connect(other.connect_request())
            .await
            .unwrap();
        let (initial, _) = read(&client).await;
        assert!(initial["head"].is_null());
        let (handle, plan) = prepare(&client, "0", "2").await;
        assert_eq!(plan["values"]["query_rows"]["value"], "2");
        assert!(read(&client).await.0["head"].is_null(), "preview is pure");
        assert!(isolated
            .configuration_command(Command::Approve {
                handle: handle.clone()
            })
            .await
            .is_err());
        assert!(serde_json::from_value::<Command>(
            json!({"action":"approve","handle":handle,"plan":{}})
        )
        .is_err());
        let (stale, _) = prepare(&competing, "0", "3").await;
        assert!(matches!(
            client
                .configuration_command(Command::Approve { handle })
                .await
                .unwrap(),
            Reply::Applied { .. }
        ));
        let refused = competing
            .configuration_command(Command::Approve { handle: stale })
            .await
            .unwrap();
        assert!(matches!(refused, Reply::Denied { .. }), "{refused:?}");
        let (current, effective) = read(&client).await;
        assert_eq!(current["head"]["revision"], "1");
        assert_eq!(effective.unwrap()["values"]["query_rows"]["value"], "2");
        assert!(read(&isolated).await.0["head"].is_null());
        assert_eq!(client.effective_query_budget().await.unwrap().max_rows, 2);
        let query = client.query(RrdQueryRequest::new(QUERY)).await.unwrap();
        let admission = query.configuration.unwrap();
        assert_eq!(admission.project_read_revision, "1");
        assert_eq!(admission.project_policy.unwrap().selected_revision, "1");
        let bounded = client
            .query(RrdQueryRequest::new(QUERY.replace("LIMIT 1", "LIMIT 3")))
            .await
            .unwrap();
        assert_eq!(
            bounded.returned_rows, 2,
            "query LIMIT cannot enlarge its admitted budget"
        );
        assert!(bounded.truncated);
        let mut over_budget = execute_query(
            QUERY,
            client.scope(),
            &client.effective_query_budget().await.unwrap(),
        )
        .unwrap();
        over_budget.budget.max_rows = 3;
        assert!(
            client
                .send(false, |session, options| {
                    let client = &client;
                    async move {
                        client
                            .client
                            .execute_query(&session, over_budget, options)
                            .await
                    }
                })
                .await
                .is_err(),
            "an explicit request above the policy is refused"
        );
        let (next, _) = prepare(&client, "1", "3").await;
        let Reply::Pending {
            prepared: Some(pending),
        } = client
            .configuration_command(Command::Pending)
            .await
            .unwrap()
        else {
            panic!("native retained preview")
        };
        assert_eq!(pending["handle"], next);
        client
            .configuration_command(Command::Discard { handle: next })
            .await
            .unwrap();
        assert_eq!(read(&client).await.0["head"]["revision"], "1");
        client.close().await.unwrap();
        competing.close().await.unwrap();
        isolated.close().await.unwrap();
    });
    engram.stop_and_reopen();
    tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(engram.connect_request())
            .await
            .unwrap();
        assert_eq!(read(&client).await.0["head"]["revision"], "1");
        let result = client.query(RrdQueryRequest::new(QUERY)).await.unwrap();
        assert_eq!(
            result
                .configuration
                .unwrap()
                .project_policy
                .unwrap()
                .selected_revision,
            "1"
        );
        client.close().await.unwrap();
    });
}
