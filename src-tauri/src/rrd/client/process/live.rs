//! Live results through the native client against a real RRD process:
//! changes arrive in cursor order across session renewal and replacement, a
//! live query reports the rows it adds, updates and removes, a subscription
//! ends across an engine restart and resumes from its cursor, and the bounds
//! and refusals hold.

use super::*;
use crate::rrd::client::live::{RrdLiveStream, MAX_LIVE_SUBSCRIPTIONS};
use crate::rrd::client::{
    LiveSink, RrdChangeCommitRequest, RrdChangePreviewRequest, RrdLiveOpenRequest,
};
use crate::rrd::view::live::{LiveAttachment, LiveEventView};
use tokio::sync::mpsc;

/// How long a test waits for the next live event.
const EVENT_TIMEOUT: Duration = Duration::from_secs(30);

fn listener() -> (LiveSink, mpsc::UnboundedReceiver<LiveEventView>) {
    let (sender, events) = mpsc::unbounded_channel();
    (Arc::new(move |event| sender.send(event).is_ok()), events)
}

async fn next(events: &mut mpsc::UnboundedReceiver<LiveEventView>) -> LiveEventView {
    tokio::time::timeout(EVENT_TIMEOUT, events.recv())
        .await
        .expect("a live event arrives in time")
        .expect("the subscription is still delivering")
}

/// The next event `pick` accepts; the events it passes over are returned too.
async fn until<T>(
    events: &mut mpsc::UnboundedReceiver<LiveEventView>,
    mut pick: impl FnMut(&LiveEventView) -> Option<T>,
) -> (T, Vec<LiveEventView>) {
    let mut passed = Vec::new();
    loop {
        let event = next(events).await;
        if let Some(found) = pick(&event) {
            return (found, passed);
        }
        passed.push(event);
    }
}

async fn subscribed(events: &mut mpsc::UnboundedReceiver<LiveEventView>) -> LiveAttachment {
    until(events, |event| match event {
        LiveEventView::Subscribed { reason, .. } => Some(*reason),
        _ => None,
    })
    .await
    .0
}

fn change(mutation: Value) -> RrdChangePreviewRequest {
    serde_json::from_value(json!({ "mutations": [mutation] })).expect("a contract change")
}

fn document(id: &str, title: &str, valid_from: u64) -> RrdChangePreviewRequest {
    change(json!({
        "mutation": "put_record",
        "reference": { "kind": "document", "id": id },
        "valid_from": valid_from,
        "properties": {
            "title": { "type": "string", "value": title },
            "group": { "type": "string", "value": "live" }
        }
    }))
}

/// Previews and commits one change; returns the cursor it landed at.
async fn commit(client: &NativeRrdClient, request: RrdChangePreviewRequest) -> u64 {
    let preview = client.preview_change(request).await.expect("preview");
    client
        .commit_change(RrdChangeCommitRequest {
            handle: preview.handle,
            operation_sha256: preview.operation_sha256,
        })
        .await
        .expect("commit")
        .last_runtime_cursor
        .expect("a data commit has a runtime cursor")
}

/// The `(cursor, target)` of every change in a `changes` event.
fn changed(event: &LiveEventView) -> Option<Vec<(u64, String)>> {
    match event {
        LiveEventView::Changes { page, .. } => Some(
            page.changes
                .iter()
                .map(|change| (change.cursor, change.mutation.target.clone()))
                .collect(),
        ),
        _ => None,
    }
}

/// Changes delivered until the one at `cursor` arrives.
async fn changes_through(
    events: &mut mpsc::UnboundedReceiver<LiveEventView>,
    cursor: u64,
) -> Vec<(u64, String)> {
    let mut delivered = Vec::new();
    loop {
        if let Some(changes) = changed(&next(events).await) {
            let done = changes.iter().any(|(at, _)| *at == cursor);
            delivered.extend(changes);
            if done {
                return delivered;
            }
        }
    }
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn live_changes_arrive_in_order_across_renewal_and_replacement() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;
        let client = Arc::new(
            NativeRrdClient::connect(estate.connect_request())
                .await
                .expect("connection"),
        );
        let (sink, mut events) = listener();
        let live = client
            .open_live(
                RrdLiveOpenRequest {
                    stream: RrdLiveStream::Changes,
                    after_cursor: None,
                },
                sink,
            )
            .await
            .expect("open live changes");
        assert_eq!(live.stream, "changes");
        assert_eq!(subscribed(&mut events).await, LiveAttachment::Opened);

        let first = commit(&client, document("d1", "Document d1", 1)).await;
        let mut delivered = changes_through(&mut events, first).await;

        // A renewal rotates the bearer; the same subscription resumes.
        client.refresh_now(false).await.expect("renew the session");
        assert_eq!(subscribed(&mut events).await, LiveAttachment::Renewed);
        let second = commit(&client, document("d2", "Document d2", 1)).await;
        delivered.extend(changes_through(&mut events, second).await);

        // A replaced session cannot resume the old subscription; a new one
        // continues after the last change handed over.
        client.refresh_now(true).await.expect("replace the session");
        assert_eq!(subscribed(&mut events).await, LiveAttachment::Replaced);
        let third = commit(&client, document("d3", "Document d3", 1)).await;
        delivered.extend(changes_through(&mut events, third).await);

        let cursors: Vec<u64> = delivered.iter().map(|(cursor, _)| *cursor).collect();
        assert!(
            cursors.windows(2).all(|pair| pair[0] < pair[1]),
            "no change repeats and none arrives out of order: {cursors:?}"
        );
        let documents: Vec<&str> = delivered
            .iter()
            .map(|(_, target)| target.as_str())
            .filter(|target| target.starts_with("document:"))
            .collect();
        assert_eq!(documents, ["document:d1", "document:d2", "document:d3"]);
        assert_eq!(cursors.last(), Some(&third));

        client.close_live(&live.handle).await.expect("close");
        let (message, _) = until(&mut events, |event| match event {
            LiveEventView::Ended { message, .. } => Some(message.clone()),
            _ => None,
        })
        .await;
        assert_eq!(message, None, "closed by the operator");
        client
            .close_live(&live.handle)
            .await
            .expect_err("a closed subscription is not open");
        client.close().await.expect("close the connection");
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn a_live_query_reports_the_rows_it_adds_updates_and_removes() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;
        let client = Arc::new(
            NativeRrdClient::connect(estate.connect_request())
                .await
                .expect("connection"),
        );
        // The first result comes back with the handle; the subscription
        // delivers everything after the cursor it was read at.
        let query = "FROM record:document AT VALID 100 KNOWN HEAD PROJECT id, title";
        let (sink, mut events) = listener();
        let live = client
            .open_live(
                RrdLiveOpenRequest {
                    stream: RrdLiveStream::Query {
                        query: query.into(),
                    },
                    after_cursor: None,
                },
                sink,
            )
            .await
            .expect("open the live query");
        assert_eq!(live.stream, "query");
        let first = live.first.as_ref().expect("the first result");
        assert_eq!(first.returned_rows, DOCUMENTS as u64);
        assert_eq!(live.after_cursor, first.known_at_cursor);
        assert_eq!(subscribed(&mut events).await, LiveAttachment::Opened);

        let rows = |event: &LiveEventView| match event {
            LiveEventView::Rows {
                added,
                updated,
                removed,
                ..
            } if !(added.is_empty() && updated.is_empty() && removed.is_empty()) => Some((
                added
                    .iter()
                    .map(|row| row.identity.clone())
                    .collect::<Vec<_>>(),
                updated
                    .iter()
                    .map(|row| {
                        (
                            row.before.values["title"].clone(),
                            row.after.values["title"].clone(),
                        )
                    })
                    .collect::<Vec<_>>(),
                removed
                    .iter()
                    .map(|row| row.identity.clone())
                    .collect::<Vec<_>>(),
            )),
            _ => None,
        };

        commit(&client, document("e1", "Document e1", 1)).await;
        let ((added, updated, removed), _) = until(&mut events, rows).await;
        assert_eq!(added.len(), 1, "{added:?}");
        assert!(added[0].ends_with(":e1"), "{added:?}");
        assert!(updated.is_empty() && removed.is_empty());

        commit(&client, document("e1", "Document e1, revised", 2)).await;
        let ((added, updated, removed), _) = until(&mut events, rows).await;
        assert_eq!(
            updated,
            [("Document e1".to_owned(), "Document e1, revised".to_owned())]
        );
        assert!(added.is_empty() && removed.is_empty());

        commit(
            &client,
            change(json!({
                "mutation": "retire_data",
                "model": "relational",
                "target": {
                    "identity": "reference",
                    "reference": { "kind": "document", "id": "e1" }
                },
                "effective_at": 3
            })),
        )
        .await;
        let ((added, updated, removed), _) = until(&mut events, rows).await;
        assert_eq!(removed.len(), 1, "{removed:?}");
        assert!(removed[0].ends_with(":e1"), "{removed:?}");
        assert!(added.is_empty() && updated.is_empty());

        client.close().await.expect("close the connection");
        let (message, _) = until(&mut events, |event| match event {
            LiveEventView::Ended { message, .. } => Some(message.clone()),
            _ => None,
        })
        .await;
        assert_eq!(message, None, "disconnecting closes live subscriptions");
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn live_results_end_across_a_restart_and_resume_from_their_cursor() {
    let mut estate = Estate::install_and_serve();
    let (before, mut events, delivered) = tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;
        let before = Arc::new(
            NativeRrdClient::connect(estate.connect_request())
                .await
                .expect("connection before the restart"),
        );
        let (sink, mut events) = listener();
        before
            .open_live(
                RrdLiveOpenRequest {
                    stream: RrdLiveStream::Changes,
                    after_cursor: None,
                },
                sink,
            )
            .await
            .expect("open live changes");
        assert_eq!(subscribed(&mut events).await, LiveAttachment::Opened);
        let cursor = commit(&before, document("r1", "Document r1", 1)).await;
        changes_through(&mut events, cursor).await;
        (before, events, cursor)
    });

    estate.restart();
    tauri::async_runtime::block_on(async {
        // The old endpoint is gone: the subscription reports that it ended
        // and that a new connection can resume it.
        let (ended, _) = until(&mut events, |event| match event {
            LiveEventView::Ended { message, retryable } => Some((message.clone(), *retryable)),
            _ => None,
        })
        .await;
        assert!(ended.0.is_some() && ended.1, "{ended:?}");
        drop(before);

        let after = Arc::new(
            NativeRrdClient::connect(estate.connect_request())
                .await
                .expect("connection after the restart"),
        );
        let landed = commit(&after, document("r2", "Document r2", 1)).await;
        let (sink, mut resumed) = listener();
        after
            .open_live(
                RrdLiveOpenRequest {
                    stream: RrdLiveStream::Changes,
                    after_cursor: Some(delivered),
                },
                sink,
            )
            .await
            .expect("resume from the last delivered cursor");
        assert_eq!(subscribed(&mut resumed).await, LiveAttachment::Opened);
        let changes = changes_through(&mut resumed, landed).await;
        assert!(changes.iter().all(|(cursor, _)| *cursor > delivered));
        assert!(changes.iter().any(|(_, target)| target == "document:r2"));
        after.close().await.expect("close");
    });
}

#[test]
#[ignore = "drives a real RRD process: set RRFLOW_BIN and run with --ignored"]
fn live_subscriptions_are_bounded_and_refusals_end_them() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;
        let client = Arc::new(
            NativeRrdClient::connect(estate.connect_request())
                .await
                .expect("connection"),
        );
        let changes = || RrdLiveOpenRequest {
            stream: RrdLiveStream::Changes,
            after_cursor: None,
        };

        // A cursor past the head is refused when the subscription opens.
        let (sink, _) = listener();
        client
            .open_live(
                RrdLiveOpenRequest {
                    stream: RrdLiveStream::Changes,
                    after_cursor: Some(u64::MAX / 2),
                },
                sink,
            )
            .await
            .expect_err("a cursor past the head");

        // A live query the engine cannot run is refused when it opens,
        // because it runs once first.
        let invalid = || RrdLiveStream::Query {
            query: "FROM record:document PROJECT".into(),
        };
        let (sink, _) = listener();
        client
            .open_live(
                RrdLiveOpenRequest {
                    stream: invalid(),
                    after_cursor: None,
                },
                sink,
            )
            .await
            .expect_err("a query the engine cannot run");
        // With a cursor of its own it is not run first, and the engine parses
        // a live query only when a change arrives: the subscription opens and
        // ends with the engine's reason at the next change.
        let head = client
            .changes(RrdChangesRequest {
                after_cursor: 0,
                limit: 1,
            })
            .await
            .expect("head")
            .head_cursor;
        let (sink, mut refused) = listener();
        client
            .open_live(
                RrdLiveOpenRequest {
                    stream: invalid(),
                    after_cursor: Some(head),
                },
                sink,
            )
            .await
            .expect("an unparsed live query opens");
        commit(&client, document("f1", "Document f1", 1)).await;
        let (ended, _) = until(&mut refused, |event| match event {
            LiveEventView::Ended { message, .. } => Some(message.clone()),
            _ => None,
        })
        .await;
        assert!(ended.is_some(), "the engine's refusal is reported");

        let mut open = Vec::new();
        let mut listeners = Vec::new();
        for _ in 0..MAX_LIVE_SUBSCRIPTIONS {
            let (sink, events) = listener();
            open.push(
                client
                    .open_live(changes(), sink)
                    .await
                    .expect("within the bound"),
            );
            listeners.push(events);
        }
        let (sink, _) = listener();
        let full = client
            .open_live(changes(), sink)
            .await
            .expect_err("over the bound");
        assert!(full.message.contains("already open"), "{full}");
        client
            .close_live(&open.remove(0).handle)
            .await
            .expect("close one");
        listeners.remove(0);
        let (sink, events) = listener();
        open.push(client.open_live(changes(), sink).await.expect("room again"));
        listeners.push(events);
        client
            .close_live("live-unknown")
            .await
            .expect_err("an unknown handle");

        // Disconnecting ends every live subscription.
        client.close().await.expect("close the connection");
        for events in &mut listeners {
            let (message, _) = until(events, |event| match event {
                LiveEventView::Ended { message, .. } => Some(message.clone()),
                _ => None,
            })
            .await;
            assert_eq!(message, None);
        }
    });
}
