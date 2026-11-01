//! Native task controls against an installed engine. No model outputs or training data.
use super::*;
use crate::rrd::client::tasks::{TaskCommand, TaskReply};

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn task_controls_preserve_engine_state_and_refuse_unconfigured_inference() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("connect");
        // This is the actual maintenance work tracked by Connectome PR26.
        // The test exercises storage/admission only; it grants no dataset consent.
        let opened = client.task_command(TaskCommand::Open {
            title: "Add native task and controller proposal workspace".into(),
            goal: "Expose engine-owned tasks, budgets and explicit controller proposals through Connectome; keep credentials native and preserve uncertain attempts.".into(),
        }).await.expect("open real maintenance task");
        let TaskReply::Task { task } = opened else {
            panic!("task reply")
        };
        let id = task.id;
        let page = client
            .task_command(TaskCommand::List {
                after_cursor: "0".into(),
            })
            .await
            .expect("list");
        let TaskReply::Page {
            tasks, truncated, ..
        } = page
        else {
            panic!("page reply")
        };
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].id, id);
        assert!(!truncated);
        let limits = client
            .capabilities()
            .await
            .expect("capabilities")
            .configuration
            .reasoning;
        let configured = client
            .task_command(TaskCommand::Configure {
                task_id: id.clone(),
                limits,
            })
            .await
            .expect("configure budget");
        let TaskReply::Budget {
            budget: Some(budget),
        } = configured
        else {
            panic!("budget reply")
        };
        assert_eq!(budget.reserved_steps, "0");
        let prepared = client
            .task_command(TaskCommand::Prepare {
                task_id: id.clone(),
            })
            .await
            .expect("inspect unavailable controller");
        let TaskReply::Prepared {
            task_sha256,
            configuration_sha256,
            unavailable,
            controller,
            ..
        } = prepared
        else {
            panic!("prepared reply")
        };
        assert!(unavailable.is_some());
        assert!(controller.is_none());
        let attempt_id = Uuid::new_v4().to_string();
        let refused = client
            .task_command(TaskCommand::Propose {
                task_id: id.clone(),
                attempt_id: attempt_id.clone(),
                expected_task_sha256: task_sha256,
                expected_configuration_sha256: configuration_sha256,
            })
            .await
            .expect("native preflight classification");
        let TaskReply::NotDispatched { reason } = refused else {
            panic!("unconfigured request was dispatched")
        };
        assert!(reason.contains("No endpoint profile"));
        let attempt = client
            .task_command(TaskCommand::Attempt {
                task_id: id.clone(),
                attempt_id,
            })
            .await
            .expect("attempt readback");
        assert!(matches!(
            attempt,
            TaskReply::Attempt {
                status: None,
                proposal: None
            }
        ));

        // A long inference lease is shared, so Stop cannot queue behind that call.
        let lease = client
            .lease_for(Duration::from_secs(120))
            .await
            .expect("long request lease");
        let stopped = tokio::time::timeout(
            Duration::from_secs(10),
            client.task_command(TaskCommand::Stop {
                task_id: id.clone(),
                expected_budget_sha256: budget.sha256,
            }),
        )
        .await
        .expect("Stop was not blocked by the shared lease")
        .expect("Stop");
        drop(lease);
        let TaskReply::Budget {
            budget: Some(stopped),
        } = stopped
        else {
            panic!("stopped budget")
        };
        assert_eq!(stopped.reserved_steps, "0");
        assert_eq!(
            stopped.stopped,
            Some(rrd_contract::ReasoningBudgetStop::Cancelled)
        );
        assert!(!stopped.execution_may_continue);
        assert!(client
            .lease_for(Duration::from_millis(client.limits.idle_timeout_ms))
            .await
            .is_err());
        client.close().await.expect("close first session");
        let reopened = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("reconnect");
        let read = reopened
            .task_command(TaskCommand::Budget {
                task_id: id.clone(),
            })
            .await
            .expect("read persisted budget");
        let TaskReply::Budget { budget: Some(read) } = read else {
            panic!("read budget")
        };
        assert_eq!(read.sha256, stopped.sha256);
        let task = reopened
            .task_command(TaskCommand::Read { task_id: id })
            .await
            .expect("read task");
        assert!(matches!(task, TaskReply::Task { .. }));
        reopened.close().await.expect("close reopened session");
    });
}
