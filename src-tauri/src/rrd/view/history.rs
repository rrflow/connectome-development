//! Views of the estate's history: changefeed pages and audit pages.
//!
//! Both are hash chains the SDK validated before Connectome projects them, so
//! each row keeps its own digest and the digest it follows.

use super::effect::{mutation, MutationView};
use super::{bounded, label};
use rrd_contract::{
    AuditPage, AuditRecordSnapshot, ChangeMutationSnapshot, ChangefeedFollowResult, ChangefeedPage,
    ResourcePath, RuntimeChangeSnapshot,
};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Serialize)]
pub struct ChangeView {
    pub cursor: u64,
    pub commit_sha256: String,
    pub commit_ordinal: u64,
    pub at_unix_ms: u64,
    pub actor: String,
    /// `data` for a typed data mutation, `claim` for an asserted claim.
    pub family: &'static str,
    pub mutation: MutationView,
    pub change_sha256: String,
    pub previous_change_sha256: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ChangesView {
    pub requested_after_cursor: u64,
    pub through_cursor: u64,
    pub head_cursor: u64,
    pub has_more: bool,
    /// How the engine proved the page against its read stamp.
    pub validation_method: String,
    pub change_reads: u64,
    pub proof_nodes: u16,
    pub changes: Vec<ChangeView>,
}

#[derive(Debug, Serialize)]
pub struct ChangesFollowView {
    /// No change arrived before the wait ended; `page` is then empty.
    pub timed_out: bool,
    pub waited_ms: u64,
    pub page: ChangesView,
}

#[derive(Debug, Serialize)]
pub struct AuditRecordView {
    pub sequence: u64,
    pub at_unix_ms: u64,
    pub principal: Option<String>,
    /// The security action, such as `transaction_commit`.
    pub action: String,
    /// The resource path, as `kind:id` segments joined by `/`.
    pub resource: String,
    pub request_id: String,
    pub operation_id: String,
    /// `authorized` before the operation runs, `completed` once it answered.
    pub phase: String,
    /// `allowed`, `denied` or `failed`.
    pub decision: String,
    pub status_code: u16,
    pub audit_sha256: String,
    pub previous_audit_sha256: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuditView {
    pub requested_after_sequence: u64,
    pub through_sequence: u64,
    pub chain_anchor_sha256: Option<String>,
    pub chain_head_sha256: Option<String>,
    pub records: Vec<AuditRecordView>,
}

fn change(change: &RuntimeChangeSnapshot) -> ChangeView {
    let (family, mutation) = match &change.mutation {
        ChangeMutationSnapshot::Data { mutation: data } => ("data", mutation(data)),
        ChangeMutationSnapshot::Claim { claim } => (
            "claim",
            MutationView {
                operation: "assert_claim".into(),
                target: bounded(format!("{} {}", claim.subject, claim.predicate)),
                subject: None,
                properties: BTreeMap::from([
                    ("object".to_owned(), bounded(claim.object.clone())),
                    ("producer".to_owned(), bounded(claim.producer.clone())),
                    ("tier".to_owned(), label(&claim.tier)),
                    ("promotion".to_owned(), label(&claim.promotion)),
                ]),
            },
        ),
    };
    ChangeView {
        cursor: change.cursor,
        commit_sha256: change.commit_sha256.clone(),
        commit_ordinal: change.commit_ordinal,
        at_unix_ms: change.at_unix_ms,
        actor: change.actor.clone(),
        family,
        mutation,
        change_sha256: change.change_sha256.clone(),
        previous_change_sha256: change.previous_change_sha256.clone(),
    }
}

pub fn changes(page: &ChangefeedPage) -> ChangesView {
    ChangesView {
        requested_after_cursor: page.requested_after_cursor,
        through_cursor: page.through_cursor,
        head_cursor: page.head_cursor,
        has_more: page.has_more,
        validation_method: page.validation.method.clone(),
        change_reads: page.validation.change_reads,
        proof_nodes: page.validation.proof_nodes,
        changes: page.changes.iter().map(change).collect(),
    }
}

pub fn follow(result: &ChangefeedFollowResult) -> ChangesFollowView {
    ChangesFollowView {
        timed_out: result.timed_out,
        waited_ms: result.waited_ms,
        page: changes(&result.page),
    }
}

fn resource(path: &ResourcePath) -> String {
    path.segments
        .iter()
        .map(|segment| format!("{}:{}", label(&segment.kind), segment.id.as_str()))
        .collect::<Vec<_>>()
        .join("/")
}

fn record(record: &AuditRecordSnapshot) -> AuditRecordView {
    AuditRecordView {
        sequence: record.sequence,
        at_unix_ms: record.at_unix_ms,
        principal: record.principal_id.as_ref().map(|id| id.as_str().into()),
        action: label(&record.action),
        resource: resource(&record.resource),
        request_id: record.request_id.clone(),
        operation_id: record.operation_id.clone(),
        phase: label(&record.phase),
        decision: label(&record.decision),
        status_code: record.status_code,
        audit_sha256: record.audit_sha256.clone(),
        previous_audit_sha256: record.previous_audit_sha256.clone(),
    }
}

pub fn audit(page: &AuditPage) -> AuditView {
    AuditView {
        requested_after_sequence: page.requested_after_sequence,
        through_sequence: page.through_sequence,
        chain_anchor_sha256: page.chain_anchor_sha256.clone(),
        chain_head_sha256: page.chain_head_sha256.clone(),
        records: page.records.iter().map(record).collect(),
    }
}
