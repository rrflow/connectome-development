//! The estate's history: changefeed pages and audit pages, read forward from
//! a cursor or sequence the webview names.
//!
//! The SDK verifies each changefeed page against the engine's read stamp and
//! each audit page's hash chain before Connectome projects it. Page sizes stay
//! well inside the SDK's four-MiB response bound.

use super::*;
use crate::rrd::view::history::{self, AuditView, ChangesFollowView, ChangesView};
use rrd_contract::{
    FollowChangefeed, ReadAudit, ReadChangefeed, MAX_CHANGEFEED_PAGE, MAX_CHANGEFEED_WAIT_MS,
};

/// Changes per page. A change carries one mutation, so a page of whole
/// records, relations or schema revisions stays far below the SDK's bound.
pub(super) const MAX_CHANGE_PAGE: u64 = 256;
const _: () = assert!(MAX_CHANGE_PAGE <= MAX_CHANGEFEED_PAGE);
/// Audit records per page.
pub(super) const MAX_AUDIT_PAGE: u16 = 512;
/// The longest a follow waits for new changes. With the engine's own bound it
/// stays inside one request timeout, so a follow never outlives its lease.
const MAX_FOLLOW_WAIT_MS: u64 = MAX_CHANGEFEED_WAIT_MS;
const _: () = assert!(MAX_FOLLOW_WAIT_MS < REQUEST_TIMEOUT.as_millis() as u64);

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdChangesRequest {
    pub after_cursor: u64,
    pub limit: u64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdChangesFollowRequest {
    pub after_cursor: u64,
    pub limit: u64,
    pub wait_timeout_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdAuditRequest {
    pub after_sequence: u64,
    pub limit: u16,
}

fn change_page(after_cursor: u64, limit: u64, scope: String) -> Result<ReadChangefeed, RrdError> {
    if limit == 0 || limit > MAX_CHANGE_PAGE {
        return Err(format!("a change page holds 1..={MAX_CHANGE_PAGE} changes").into());
    }
    Ok(ReadChangefeed {
        scope,
        after_cursor,
        limit,
    })
}

pub(super) fn audit_page(after_sequence: u64, limit: u16) -> Result<ReadAudit, RrdError> {
    if limit == 0 || limit > MAX_AUDIT_PAGE {
        return Err(format!("an audit page holds 1..={MAX_AUDIT_PAGE} records").into());
    }
    Ok(ReadAudit {
        after_sequence,
        limit,
    })
}

impl NativeRrdClient {
    pub async fn changes(&self, request: RrdChangesRequest) -> Result<ChangesView, RrdError> {
        let read = change_page(request.after_cursor, request.limit, self.scope())?;
        let page = self
            .send(false, |session, options| async move {
                self.client.read_changefeed(&session, read, options).await
            })
            .await?;
        Ok(history::changes(&page))
    }

    /// Waits up to `wait_timeout_ms` for changes after `after_cursor`.
    pub async fn follow_changes(
        &self,
        request: RrdChangesFollowRequest,
    ) -> Result<ChangesFollowView, RrdError> {
        if request.wait_timeout_ms == 0 || request.wait_timeout_ms > MAX_FOLLOW_WAIT_MS {
            return Err(format!("a follow waits 1..={MAX_FOLLOW_WAIT_MS} ms").into());
        }
        let follow = FollowChangefeed {
            read: change_page(request.after_cursor, request.limit, self.scope())?,
            wait_timeout_ms: request.wait_timeout_ms,
        };
        let result = self
            .send(false, |session, options| async move {
                self.client
                    .follow_changefeed(&session, follow, options)
                    .await
            })
            .await?;
        Ok(history::follow(&result))
    }

    pub async fn audit(&self, request: RrdAuditRequest) -> Result<AuditView, RrdError> {
        let read = audit_page(request.after_sequence, request.limit)?;
        let page = self
            .send(false, |session, options| async move {
                self.client.read_audit(&session, read, options).await
            })
            .await?;
        Ok(history::audit(&page))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn history_pages_are_bounded_before_any_request() {
        assert!(change_page(0, 0, "instance:a".into()).is_err());
        assert!(change_page(0, MAX_CHANGE_PAGE + 1, "instance:a".into()).is_err());
        assert_eq!(
            change_page(7, MAX_CHANGE_PAGE, "instance:a".into())
                .expect("bounded page")
                .after_cursor,
            7
        );
        assert!(audit_page(0, 0).is_err());
        assert!(audit_page(0, MAX_AUDIT_PAGE + 1).is_err());
        assert!(audit_page(3, MAX_AUDIT_PAGE).is_ok());
    }
}
