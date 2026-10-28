//! Live results: durable engine subscriptions delivered over `/v1/ws`.
//!
//! Each live subscription runs in its own task with its own socket. A
//! delivery is handed to the webview first and acknowledged after, so the
//! engine's durable cursor never passes what the webview was given. After a
//! reconnect the engine replays from that cursor, and the task skips
//! whatever it already handed over.
//!
//! The engine authorizes every poll, acknowledgement and heartbeat on a
//! socket with the bearer the socket connected with. Renewing the session
//! rotates that bearer, so the task reconnects whenever the lease changes.
//! After a renewal it resumes the same subscription. A durable subscription
//! belongs to the session that opened it, so once the session is replaced the
//! task opens a new subscription after the last cursor it handed over.

use super::*;
use crate::rrd::view::history;
use crate::rrd::view::live::{self, LiveAttachment, LiveEventView, LiveView};
use rrd_client::RrdWebSocket;
use rrd_contract::{
    CloseSubscription, CorrelationId, ErrorCode, OpenSubscription, ReadChangefeed,
    SubscriptionAcknowledgement, SubscriptionDelivery, SubscriptionResume, SubscriptionStream,
    WebSocketErrorTarget, WebSocketPayload,
};
use std::collections::BTreeMap;
use std::future::{poll_fn, Future};
use std::pin::pin;
use std::sync::Weak;
use std::task::Poll;
use tokio::sync::watch;
use tokio::task::JoinHandle;

/// Live subscriptions open at once per connection.
pub(super) const MAX_LIVE_SUBSCRIPTIONS: usize = 8;
/// Changes per changefeed delivery, small enough for one WebSocket message.
const LIVE_BATCH_CHANGES: u64 = 32;
/// Rows per live-query delivery, for the same reason.
const LIVE_MAX_DELTA_ROWS: u64 = 256;
/// How far behind the head a subscription may fall and still resume.
const LIVE_RETENTION_CURSORS: u64 = 1_000_000;
/// How long the engine keeps a subscription without a heartbeat or an ACK.
const LIVE_LEASE_MS: u64 = 60_000;
/// How often the engine polls a subscription for new results.
const LIVE_POLL_MS: u64 = 500;
/// Consecutive failed connections before a subscription gives up.
const RECONNECT_ATTEMPTS: u32 = 3;
const RECONNECT_BACKOFF: Duration = Duration::from_millis(500);
/// How long closing waits for a task to close its durable subscription.
const CLOSE_TIMEOUT: Duration = Duration::from_secs(10);
const NO_LIVE_SUBSCRIPTION: &str = "this live subscription is not open";

/// Where a live subscription's events go; `false` once nobody listens.
pub type LiveSink = Arc<dyn Fn(LiveEventView) -> bool + Send + Sync>;

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum RrdLiveStream {
    /// Every change in the estate.
    Changes,
    /// The rows an rrflowQL query adds, updates and removes.
    Query { query: String },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdLiveOpenRequest {
    pub stream: RrdLiveStream,
    /// Deliver what follows this cursor. Without one, changes start at the
    /// estate's head, and a live query runs once and starts at the cursor of
    /// that first result. A caller that passes a cursor for a live query
    /// already holds its result at that cursor.
    #[serde(default)]
    pub after_cursor: Option<u64>,
}

struct LiveTask {
    stop: watch::Sender<bool>,
    task: JoinHandle<()>,
}

/// The live subscriptions one connection runs, by handle.
#[derive(Default)]
pub(super) struct LiveSubscriptions(tokio::sync::Mutex<BTreeMap<String, LiveTask>>);

async fn stop(task: LiveTask) {
    let _ = task.stop.send(true);
    let mut join = task.task;
    if tokio::time::timeout(CLOSE_TIMEOUT, &mut join)
        .await
        .is_err()
    {
        join.abort();
    }
}

impl LiveSubscriptions {
    pub(super) async fn close_all(&self) {
        let tasks = std::mem::take(&mut *self.0.lock().await);
        for (_, task) in tasks {
            stop(task).await;
        }
    }
}

/// A durable subscription and the open request that created it. Replaying
/// that open under its own idempotency key returns the subscription's current
/// durable state.
struct Durable {
    open: OpenSubscription,
    options: RequestOptions,
    owner: CorrelationId,
}

/// What a connection's wait ended on.
enum Next {
    Stop,
    LeaseChanged,
    Heartbeat,
    Frame(Box<rrd_client::Result<rrd_contract::WebSocketFrame>>),
}

enum Exit {
    /// The operator closed the subscription.
    Stopped,
    /// Nobody listens to its events any more.
    Unheard,
    /// The lease changed; reconnect with the new bearer.
    LeaseChanged,
    /// The socket was lost; reconnect.
    Lost(RrdError),
    /// The engine refused the subscription; it cannot continue.
    Refused(RrdError),
}

fn subscription_id() -> Result<CorrelationId, RrdError> {
    CorrelationId::new(format!("connectome-live-{}", Uuid::new_v4().simple()))
        .map_err(|error| error.to_string().into())
}

/// The part of a delivery not yet handed to the webview, if any.
fn unseen(
    delivery: &SubscriptionDelivery,
    from_cursor: u64,
    through_cursor: u64,
    delivered_through: u64,
) -> Option<LiveEventView> {
    if through_cursor <= delivered_through {
        return None;
    }
    Some(match delivery {
        SubscriptionDelivery::Changefeed { page } => {
            let mut page = page.clone();
            page.changes
                .retain(|change| change.cursor > delivered_through);
            LiveEventView::Changes {
                from_cursor: from_cursor.max(delivered_through),
                through_cursor,
                page: history::changes(&page),
            }
        }
        SubscriptionDelivery::LiveQuery { delta } => live::rows(delta),
    })
}

impl NativeRrdClient {
    /// Opens a live subscription and starts delivering its events to `sink`.
    /// The durable subscription is opened before this returns, so a refused
    /// cursor or query budget fails here. A live query opened without a
    /// cursor runs once first: its result comes back with the handle, and the
    /// subscription delivers what follows the cursor it was read at. The
    /// engine parses a live query only when a change arrives, so this is also
    /// where a query it cannot run is refused.
    pub async fn open_live(
        self: &Arc<Self>,
        request: RrdLiveOpenRequest,
        sink: LiveSink,
    ) -> Result<LiveView, RrdError> {
        let scope = self.scope();
        let mut subscriptions = self.live.0.lock().await;
        subscriptions.retain(|_, live| !live.task.is_finished());
        if subscriptions.len() >= MAX_LIVE_SUBSCRIPTIONS {
            return Err(format!(
                "{MAX_LIVE_SUBSCRIPTIONS} live subscriptions are already open on this connection; close one first"
            )
            .into());
        }
        let mut first = None;
        let (stream, kind, after_cursor) = match request.stream {
            RrdLiveStream::Changes => {
                let after_cursor = match request.after_cursor {
                    Some(cursor) => cursor,
                    None => self.head_cursor().await?,
                };
                (
                    SubscriptionStream::Changefeed { scope },
                    "changes",
                    after_cursor,
                )
            }
            RrdLiveStream::Query { query } => {
                let query = execute_query(&query, scope, &self.query_budget)?;
                let after_cursor = match request.after_cursor {
                    Some(cursor) => cursor,
                    None => {
                        let run = query.clone();
                        let result = self
                            .send(false, |session, options| async move {
                                self.client.execute_query(&session, run, options).await
                            })
                            .await?;
                        let cursor = result.known_at_cursor;
                        first = Some(view::query(&result));
                        cursor
                    }
                };
                (
                    SubscriptionStream::LiveQuery {
                        scope: query.scope,
                        query: query.query,
                        parameters: query.parameters,
                        budget: query.budget,
                        max_delta_rows: LIVE_MAX_DELTA_ROWS,
                    },
                    "query",
                    after_cursor,
                )
            }
        };
        let open = OpenSubscription {
            subscription_id: subscription_id()?,
            stream,
            after_cursor,
            batch_size: LIVE_BATCH_CHANGES,
            max_in_flight: 1,
            retention_cursor_window: LIVE_RETENTION_CURSORS,
            lease_ms: LIVE_LEASE_MS,
            heartbeat_interval_ms: LIVE_POLL_MS,
        };
        open.validate().map_err(|error| error.to_string())?;
        let options = self.ids.next(true)?;
        let lease = self.lease().await?;
        let owner = lease.session.session_id().clone();
        let opened = self
            .client
            .open_subscription(&lease.session, open.clone(), options.clone())
            .await;
        drop(lease);
        opened.map_err(RrdError::sdk)?;

        let handle = format!("live-{}", Uuid::new_v4().simple());
        let (stop, stopped) = watch::channel(false);
        let durable = Durable {
            open,
            options,
            owner,
        };
        let task = tokio::spawn(run(
            Arc::downgrade(self),
            durable,
            sink,
            stopped,
            after_cursor,
        ));
        subscriptions.insert(handle.clone(), LiveTask { stop, task });
        Ok(LiveView {
            handle,
            stream: kind,
            after_cursor,
            first,
        })
    }

    /// Stops the live subscription `handle` names and closes it on the engine.
    pub async fn close_live(&self, handle: &str) -> Result<(), RrdError> {
        let task = self
            .live
            .0
            .lock()
            .await
            .remove(handle)
            .ok_or(NO_LIVE_SUBSCRIPTION)?;
        stop(task).await;
        Ok(())
    }

    async fn head_cursor(&self) -> Result<u64, RrdError> {
        let read = ReadChangefeed {
            scope: self.scope(),
            after_cursor: 0,
            limit: 1,
        };
        let page = self
            .send(false, |session, options| async move {
                self.client.read_changefeed(&session, read, options).await
            })
            .await?;
        Ok(page.head_cursor)
    }

    /// Connects a socket on the current session and asks the engine to attach
    /// the subscription to it. Returns why it was attached.
    async fn attach(
        &self,
        durable: &mut Durable,
        requested: LiveAttachment,
        delivered_through: u64,
        bearer: &mut watch::Receiver<u64>,
    ) -> Result<(RrdWebSocket, LiveAttachment), RrdError> {
        let lease = self.lease().await?;
        // No refresh can happen while the lease is held, so every later one
        // changes the generation this marks as seen.
        bearer.borrow_and_update();
        let session = lease.session.clone();
        let mut reason = requested;
        if session.session_id() != &durable.owner {
            durable.open.subscription_id = subscription_id()?;
            durable.open.after_cursor = delivered_through;
            durable.options = self.ids.next(true)?;
            durable.owner = session.session_id().clone();
            reason = LiveAttachment::Replaced;
        }
        let opened = self
            .client
            .open_subscription(&session, durable.open.clone(), durable.options.clone())
            .await
            .map_err(RrdError::sdk)?;
        let mut socket = self
            .client
            .connect_websocket(&session)
            .await
            .map_err(RrdError::sdk)?;
        drop(lease);
        socket
            .subscribe(SubscriptionResume::from_snapshot(&opened.subscription))
            .await
            .map_err(RrdError::sdk)?;
        Ok((socket, reason))
    }

    /// Delivers one connection's events until it ends. `attached` is set
    /// once the engine attached the subscription to this connection.
    #[allow(clippy::too_many_arguments)]
    async fn pump(
        &self,
        socket: &mut RrdWebSocket,
        reason: LiveAttachment,
        sink: &LiveSink,
        stopped: &mut watch::Receiver<bool>,
        bearer: &mut watch::Receiver<u64>,
        delivered_through: &mut u64,
        attached: &mut bool,
    ) -> Exit {
        let every = Duration::from_millis(socket.limits().heartbeat_interval_ms);
        let mut heartbeat = tokio::time::interval_at(tokio::time::Instant::now() + every, every);
        loop {
            let next = {
                let mut stop = pin!(stopped.changed());
                let mut lease = pin!(bearer.changed());
                let mut tick = pin!(heartbeat.tick());
                let mut frame = pin!(socket.receive());
                // Biased: a stop or a new lease wins over a pending frame.
                poll_fn(|cx| {
                    if stop.as_mut().poll(cx).is_ready() {
                        return Poll::Ready(Next::Stop);
                    }
                    if lease.as_mut().poll(cx).is_ready() {
                        return Poll::Ready(Next::LeaseChanged);
                    }
                    if tick.as_mut().poll(cx).is_ready() {
                        return Poll::Ready(Next::Heartbeat);
                    }
                    frame
                        .as_mut()
                        .poll(cx)
                        .map(|frame| Next::Frame(Box::new(frame)))
                })
                .await
            };
            let frame = match next {
                Next::Stop => return Exit::Stopped,
                Next::LeaseChanged => return Exit::LeaseChanged,
                Next::Heartbeat => {
                    // A lease near its deadline is refreshed here, which
                    // changes the bearer generation and reconnects the socket.
                    if let Err(error) = self.lease().await.map(drop) {
                        return Exit::Refused(error);
                    }
                    let id = match self.ids.next(false) {
                        Ok(options) => options.request_id,
                        Err(error) => return Exit::Refused(error),
                    };
                    if let Err(error) = socket.heartbeat(id).await {
                        return Exit::Lost(RrdError::sdk(error));
                    }
                    continue;
                }
                Next::Frame(frame) => frame,
            };
            match *frame {
                Ok(frame) => match frame.payload {
                    WebSocketPayload::Subscribed(subscribed) => {
                        *attached = true;
                        let snapshot = subscribed.subscription;
                        if !sink(LiveEventView::Subscribed {
                            reason,
                            generation: snapshot.connection_generation,
                            acknowledged_cursor: snapshot.acknowledged_cursor,
                            head_cursor: snapshot.head_cursor,
                        }) {
                            return Exit::Unheard;
                        }
                    }
                    WebSocketPayload::Delivery(delivery) => {
                        let event = unseen(
                            &delivery.delivery,
                            delivery.from_cursor,
                            delivery.through_cursor,
                            *delivered_through,
                        );
                        if let Some(event) = event {
                            if !sink(event) {
                                return Exit::Unheard;
                            }
                        }
                        *delivered_through = (*delivered_through).max(delivery.through_cursor);
                        let acknowledged = socket
                            .acknowledge(SubscriptionAcknowledgement {
                                subscription_id: delivery.subscription_id,
                                connection_generation: delivery.connection_generation,
                                delivery_sequence: delivery.delivery_sequence,
                                through_cursor: delivery.through_cursor,
                            })
                            .await;
                        if let Err(error) = acknowledged {
                            return Exit::Lost(RrdError::sdk(error));
                        }
                    }
                    _ => {}
                },
                Err(rrd_client::Error::WebSocket(error)) => {
                    let code = error.error.code;
                    let subscription =
                        matches!(error.target, WebSocketErrorTarget::Subscription { .. });
                    let refused = RrdError::sdk(rrd_client::Error::WebSocket(error));
                    // A bearer the engine no longer accepts means reconnect;
                    // any other refusal of the subscription ends it.
                    return if code != ErrorCode::Unauthenticated && subscription {
                        Exit::Refused(refused)
                    } else {
                        Exit::Lost(refused)
                    };
                }
                Err(error) => return Exit::Lost(RrdError::sdk(error)),
            }
        }
    }

    /// Closes the durable subscription, when the session that owns it is
    /// still the current one; otherwise its lease lapses on the engine.
    async fn detach(&self, durable: &Durable) {
        let Ok(lease) = self.lease().await else {
            return;
        };
        if lease.session.session_id() != &durable.owner {
            return;
        }
        let Ok(options) = self.ids.next(true) else {
            return;
        };
        let _ = self
            .client
            .close_subscription(
                &lease.session,
                CloseSubscription {
                    subscription_id: durable.open.subscription_id.clone(),
                },
                options,
            )
            .await;
    }
}

/// One live subscription's task: attach, deliver, and reattach until it is
/// stopped, nobody listens, or it cannot continue.
async fn run(
    client: Weak<NativeRrdClient>,
    mut durable: Durable,
    sink: LiveSink,
    mut stopped: watch::Receiver<bool>,
    mut delivered_through: u64,
) {
    let mut requested = LiveAttachment::Opened;
    let mut failures = 0;
    let ended = loop {
        let Some(client) = client.upgrade() else {
            return;
        };
        let mut bearer = client.bearer_generation.subscribe();
        let connection = client
            .attach(&mut durable, requested, delivered_through, &mut bearer)
            .await;
        let exit = match connection {
            Ok((mut socket, reason)) => {
                let mut attached = false;
                let exit = client
                    .pump(
                        &mut socket,
                        reason,
                        &sink,
                        &mut stopped,
                        &mut bearer,
                        &mut delivered_through,
                        &mut attached,
                    )
                    .await;
                let _ = socket.close().await;
                // Only a connection the engine attached counts as recovered,
                // so one that keeps failing at once still gives up.
                if attached {
                    failures = 0;
                }
                exit
            }
            Err(error) if error.message == SESSION_CLOSED => Exit::Refused(error),
            Err(error) => Exit::Lost(error),
        };
        match exit {
            Exit::Stopped => {
                client.detach(&durable).await;
                break Some(LiveEventView::Ended {
                    message: None,
                    retryable: false,
                });
            }
            Exit::Unheard => {
                client.detach(&durable).await;
                break None;
            }
            Exit::LeaseChanged => requested = LiveAttachment::Renewed,
            Exit::Refused(error) => {
                client.detach(&durable).await;
                break Some(LiveEventView::Ended {
                    message: Some(error.message),
                    retryable: error.retryable,
                });
            }
            Exit::Lost(error) => {
                failures += 1;
                if failures >= RECONNECT_ATTEMPTS {
                    break Some(LiveEventView::Ended {
                        message: Some(error.message),
                        retryable: true,
                    });
                }
                requested = LiveAttachment::Reconnected;
                drop(client);
                let stop = {
                    let mut stop = pin!(stopped.changed());
                    let mut wait = pin!(tokio::time::sleep(RECONNECT_BACKOFF * failures));
                    poll_fn(|cx| {
                        if stop.as_mut().poll(cx).is_ready() {
                            return Poll::Ready(true);
                        }
                        wait.as_mut().poll(cx).map(|()| false)
                    })
                    .await
                };
                if stop {
                    break Some(LiveEventView::Ended {
                        message: None,
                        retryable: false,
                    });
                }
            }
        }
    };
    if let Some(event) = ended {
        sink(event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rrd_contract::{ChangefeedPage, ChangefeedValidation};

    fn page(cursors: &[u64]) -> SubscriptionDelivery {
        SubscriptionDelivery::Changefeed {
            page: ChangefeedPage {
                requested_after_cursor: cursors[0] - 1,
                through_cursor: *cursors.last().expect("cursor"),
                head_cursor: *cursors.last().expect("cursor"),
                has_more: false,
                validation: ChangefeedValidation {
                    method: "test".into(),
                    change_reads: 0,
                    proof_nodes: 0,
                },
                changes: Vec::new(),
            },
        }
    }

    #[test]
    fn a_replayed_delivery_hands_over_only_what_is_new() {
        assert!(
            unseen(&page(&[4, 5]), 3, 5, 5).is_none(),
            "already handed over"
        );
        let Some(LiveEventView::Changes {
            from_cursor,
            through_cursor,
            ..
        }) = unseen(&page(&[4, 5, 6]), 3, 6, 5)
        else {
            panic!("the unseen tail is handed over");
        };
        assert_eq!((from_cursor, through_cursor), (5, 6));
    }

    #[test]
    fn a_live_request_names_its_stream_and_nothing_else() {
        let changes: RrdLiveOpenRequest =
            serde_json::from_value(serde_json::json!({ "stream": { "kind": "changes" } }))
                .expect("changes");
        assert!(matches!(changes.stream, RrdLiveStream::Changes));
        assert!(changes.after_cursor.is_none());
        let query: RrdLiveOpenRequest = serde_json::from_value(serde_json::json!({
            "stream": { "kind": "query", "query": "FROM record:document AT VALID 1 KNOWN HEAD PROJECT *" },
            "after_cursor": 7
        }))
        .expect("query");
        assert_eq!(query.after_cursor, Some(7));
        assert!(
            serde_json::from_value::<RrdLiveOpenRequest>(serde_json::json!({
                "stream": { "kind": "changes" },
                "subscription_id": "chosen-by-the-webview"
            }))
            .is_err()
        );
    }
}
