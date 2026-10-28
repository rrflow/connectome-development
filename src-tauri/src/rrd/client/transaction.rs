//! Governed data changes: preview, then commit exactly what was previewed.
//!
//! The webview proposes mutations and gets back a preview under an opaque
//! handle. A commit names only that handle and the operation digest the
//! operator was shown; the mutations it commits are the previewed ones, held
//! here, so the webview can neither alter a change between preview and commit
//! nor commit one it was not shown.
//!
//! Connectome's session policy allows one open transaction, so at most one
//! change is pending per connection and a new preview discards the one before
//! it. A transaction lives in the session that began it: renewal keeps the
//! session and the pending change, while a replaced session has lost it, and
//! the commit then fails closed instead of reaching another transaction.

use super::*;
use crate::rrd::view::effect::{self, ChangePreviewView, CommitReceiptView};
use rrd_contract::{
    AbortTransaction, BeginTransaction, CommitTransaction, CorrelationId, PreviewTransaction,
    TransactionMutation, MAX_TRANSACTION_CLAIMS,
};

/// How long a preview stays open for its commit.
pub(super) const CHANGE_TIMEOUT_MS: u64 = 300_000;
/// Storage keys the engine may read to build the prospective snapshot: the
/// contract's default. The snapshot covers the whole data scope, so an estate
/// with more keys than this cannot be previewed until RRFlow bounds the
/// preview to the mutations' targets.
pub(super) const PREVIEW_MAX_STORAGE_KEYS: u32 = 10_000;
const DATA_SCOPE: &str = "data";
const SESSION_REPLACED: &str = "the session that previewed this change has ended; preview it again";
const NO_PENDING_CHANGE: &str =
    "this change is no longer pending: it was committed, discarded, or replaced by a newer preview";

pub(super) struct PendingChange {
    handle: String,
    session_id: CorrelationId,
    transaction_id: CorrelationId,
    operation_sha256: String,
    mutations: Vec<TransactionMutation>,
    /// Reused by every commit attempt, so a commit retried after a lost reply
    /// replays the first one instead of conflicting with it.
    commit: RequestOptions,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdChangePreviewRequest {
    pub mutations: Vec<TransactionMutation>,
    /// Valid time of the prospective snapshot; the engine's request time when
    /// absent.
    #[serde(default)]
    pub valid_at: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdChangeCommitRequest {
    pub handle: String,
    /// The digest the operator approved; it must equal the previewed one.
    pub operation_sha256: String,
}

/// Whether a failed engine call may still have taken effect, so the request
/// can only be settled by repeating it.
fn outcome_unknown(error: &rrd_client::Error) -> bool {
    match error {
        rrd_client::Error::Transport(_) | rrd_client::Error::Timeout => true,
        rrd_client::Error::Api { error, .. } => error.retryable,
        _ => false,
    }
}

impl NativeRrdClient {
    /// Begins a transaction, previews `request` inside it, and keeps the
    /// previewed change pending under a new handle. A pending change from an
    /// earlier preview is discarded first.
    pub async fn preview_change(
        &self,
        request: RrdChangePreviewRequest,
    ) -> Result<ChangePreviewView, RrdError> {
        if request.mutations.is_empty() || request.mutations.len() > MAX_TRANSACTION_CLAIMS {
            return Err(format!("a change carries 1..={MAX_TRANSACTION_CLAIMS} mutations").into());
        }
        if request.valid_at == Some(0) {
            return Err("a preview's valid time must be greater than zero".into());
        }
        let mut pending = self.pending.lock().await;
        if let Some(previous) = pending.take() {
            if let Err(error) = self
                .abort(&previous.session_id, &previous.transaction_id)
                .await
            {
                // An unsettled discard keeps the old change pending, so the
                // next preview tries again instead of exceeding the quota.
                if error.retryable {
                    *pending = Some(previous);
                }
                return Err(error);
            }
        }

        let begin = BeginTransaction {
            scope: canonical(DATA_SCOPE, "transaction scope")?,
            timeout_ms: CHANGE_TIMEOUT_MS,
        };
        let transaction = self
            .send(true, |session, options| async move {
                self.client
                    .begin_transaction(&session, begin, options)
                    .await
            })
            .await?;
        let previewed = {
            let lease = self.lease().await?;
            if lease.session.session_id() != &transaction.session_id {
                return Err(SESSION_REPLACED.into());
            }
            let previewed = self
                .client
                .preview_transaction(
                    &lease.session,
                    &transaction.transaction_id,
                    PreviewTransaction {
                        mutations: request.mutations,
                        valid_at: request.valid_at,
                        max_storage_keys: PREVIEW_MAX_STORAGE_KEYS,
                    },
                    self.ids.next(true)?,
                )
                .await;
            drop(lease);
            previewed
        };
        let previewed = match previewed {
            Ok(previewed) => previewed,
            Err(error) => {
                // Release the quota the refused preview would otherwise hold.
                let _ = self
                    .abort(&transaction.session_id, &transaction.transaction_id)
                    .await;
                return Err(RrdError::sdk(error));
            }
        };
        if previewed.transaction_id != transaction.transaction_id {
            let _ = self
                .abort(&transaction.session_id, &transaction.transaction_id)
                .await;
            return Err("the engine previewed a different transaction".into());
        }

        let handle = format!("change-{}", Uuid::new_v4().simple());
        let view = effect::preview(handle.clone(), &previewed, CHANGE_TIMEOUT_MS);
        *pending = Some(PendingChange {
            handle,
            session_id: transaction.session_id,
            transaction_id: transaction.transaction_id,
            operation_sha256: previewed.operation_sha256,
            mutations: previewed.mutations,
            commit: self.ids.next(true)?,
        });
        Ok(view)
    }

    /// Commits the pending change named by `request.handle`, exactly as it was
    /// previewed. Only a commit whose outcome is unknown keeps it pending, so
    /// that repeating the commit settles it. A refused commit releases its
    /// transaction, so the session's one transaction is free for the next
    /// preview.
    pub async fn commit_change(
        &self,
        request: RrdChangeCommitRequest,
    ) -> Result<CommitReceiptView, RrdError> {
        let mut pending = self.pending.lock().await;
        let change = pending
            .as_ref()
            .filter(|change| change.handle == request.handle)
            .ok_or(NO_PENDING_CHANGE)?;
        if change.operation_sha256 != request.operation_sha256 {
            return Err("the approved digest differs from the previewed change".into());
        }
        let lease = self.lease().await?;
        if lease.session.session_id() != &change.session_id {
            drop(lease);
            *pending = None;
            return Err(SESSION_REPLACED.into());
        }
        // The engine requires a commit deadline. Each attempt gets a fresh one;
        // the idempotency key, which decides a replay, never changes.
        let mut options = change.commit.clone();
        options.deadline_unix_ms = Some(now_unix_ms()? + REQUEST_TIMEOUT.as_millis() as u64);
        let committed = self
            .client
            .commit_transaction(
                &lease.session,
                &change.transaction_id,
                CommitTransaction {
                    operation_sha256: change.operation_sha256.clone(),
                    mutations: change.mutations.clone(),
                },
                options,
            )
            .await;
        drop(lease);
        match committed {
            Ok(receipt) if receipt.operation_sha256 == change.operation_sha256 => {
                *pending = None;
                Ok(effect::receipt(&receipt))
            }
            Ok(_) => {
                *pending = None;
                Err("the engine committed a different operation".into())
            }
            Err(error) if outcome_unknown(&error) => Err(RrdError::sdk(error)),
            Err(error) => {
                let _ = self.abort(&change.session_id, &change.transaction_id).await;
                *pending = None;
                Err(RrdError::sdk(error))
            }
        }
    }

    /// Discards the pending change named by `handle`; nothing is committed.
    pub async fn discard_change(&self, handle: &str) -> Result<(), RrdError> {
        let mut pending = self.pending.lock().await;
        let change = pending
            .take_if(|change| change.handle == handle)
            .ok_or(NO_PENDING_CHANGE)?;
        if let Err(error) = self.abort(&change.session_id, &change.transaction_id).await {
            if error.retryable {
                *pending = Some(change);
            }
            return Err(error);
        }
        Ok(())
    }

    /// Aborts a change's transaction. A transaction that is already
    /// closed, expired or gone with its session counts as discarded; only an
    /// abort whose outcome is unknown is retryable.
    async fn abort(
        &self,
        session_id: &CorrelationId,
        transaction_id: &CorrelationId,
    ) -> Result<(), RrdError> {
        let lease = self.lease().await?;
        if lease.session.session_id() != session_id {
            return Ok(());
        }
        let aborted = self
            .client
            .abort_transaction(
                &lease.session,
                transaction_id,
                AbortTransaction {},
                self.ids.next(true)?,
            )
            .await;
        drop(lease);
        match aborted {
            Ok(_) => Ok(()),
            Err(error) if outcome_unknown(&error) => {
                let mut unknown = RrdError::from(error.to_string());
                unknown.retryable = true;
                Err(unknown)
            }
            Err(_) => Ok(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::StatusCode;
    use rrd_contract::{ErrorBody, ErrorCode};

    fn api(code: ErrorCode, retryable: bool) -> rrd_client::Error {
        rrd_client::Error::Api {
            status: StatusCode::CONFLICT,
            error: ErrorBody {
                code,
                message: "refused".into(),
                retryable,
                details: Default::default(),
            },
        }
    }

    #[test]
    fn only_an_unsettled_request_keeps_a_change_pending() {
        assert!(outcome_unknown(&rrd_client::Error::Timeout));
        assert!(outcome_unknown(&rrd_client::Error::Transport(
            "reset".into()
        )));
        assert!(outcome_unknown(&api(ErrorCode::Conflict, true)));
        assert!(!outcome_unknown(&api(ErrorCode::Conflict, false)));
        assert!(!outcome_unknown(
            &rrd_client::Error::ResponseIdentityMismatch
        ));
    }

    #[test]
    fn a_change_request_names_only_its_handle_and_digest() {
        let commit: Result<RrdChangeCommitRequest, _> = serde_json::from_value(serde_json::json!({
            "handle": "change-1",
            "operation_sha256": "0".repeat(64),
            "mutations": [],
        }));
        assert!(
            commit.is_err(),
            "a commit cannot carry mutations of its own"
        );
        let preview: RrdChangePreviewRequest = serde_json::from_value(serde_json::json!({
            "mutations": [{
                "mutation": "put_record",
                "reference": { "kind": "document", "id": "a1" },
                "valid_from": 1,
                "properties": {}
            }]
        }))
        .expect("a preview carries contract mutations");
        assert_eq!(preview.mutations.len(), 1);
        assert!(preview.valid_at.is_none());
    }
}
