//! Views of live results: what a live subscription hands the webview.
//!
//! A subscription delivers changefeed pages or live-query deltas in cursor
//! order. After a reconnect the engine replays from its durable
//! acknowledgement, and the native process skips what it already handed over,
//! so a page never repeats a change. A live-query delta can still overlap the
//! one before it after a reconnect; rows are applied by identity.

use super::history::ChangesView;
use super::{query_row, QueryView, RowView};
use rrd_contract::LiveQueryDeltaResult;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct LiveView {
    /// Opaque to the webview; names the live subscription in this process only.
    pub handle: String,
    /// `changes` or `query`.
    pub stream: &'static str,
    /// The cursor the subscription delivers after.
    pub after_cursor: u64,
    /// A live query's first result, read at `after_cursor`, when it was
    /// opened without a cursor of its own.
    pub first: Option<QueryView>,
}

#[derive(Debug, Serialize)]
pub struct RowChangeView {
    pub before: RowView,
    pub after: RowView,
}

/// Why a subscription was attached to a connection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LiveAttachment {
    /// The first connection after it opened.
    Opened,
    /// The connection was lost and replaced; the subscription resumed.
    Reconnected,
    /// The session was renewed, rotating the bearer; the subscription resumed.
    Renewed,
    /// The session was replaced; a new subscription continues after the last
    /// cursor handed to the webview.
    Replaced,
}

#[derive(Debug, Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum LiveEventView {
    /// The engine attached the subscription to a connection.
    Subscribed {
        reason: LiveAttachment,
        generation: u64,
        acknowledged_cursor: u64,
        head_cursor: u64,
    },
    Changes {
        from_cursor: u64,
        through_cursor: u64,
        page: ChangesView,
    },
    Rows {
        from_cursor: u64,
        through_cursor: u64,
        head_cursor: u64,
        added: Vec<RowView>,
        updated: Vec<RowChangeView>,
        removed: Vec<RowView>,
    },
    /// The subscription ended: closed by the operator (`message` is null) or
    /// stopped by a failure it could not recover from.
    Ended {
        message: Option<String>,
        retryable: bool,
    },
}

pub fn rows(delta: &LiveQueryDeltaResult) -> LiveEventView {
    LiveEventView::Rows {
        from_cursor: delta.from_cursor,
        through_cursor: delta.through_cursor,
        head_cursor: delta.head_cursor,
        added: delta.added.iter().map(query_row).collect(),
        updated: delta
            .updated
            .iter()
            .map(|change| RowChangeView {
                before: query_row(&change.before),
                after: query_row(&change.after),
            })
            .collect(),
        removed: delta.removed.iter().map(query_row).collect(),
    }
}
