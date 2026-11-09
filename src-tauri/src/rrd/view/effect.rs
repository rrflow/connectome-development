//! Views of governed effects: a change preview and its commit receipt,
//! backups and restores, and export artifacts.
//!
//! A preview shows what each mutation writes. Raw vector values stay native,
//! and the prospective snapshot crosses as its read stamp and counts, never as
//! its entries.

use super::{bounded, display_properties, label};
use rrd_contract::{
    AuditExport, CommitReceipt, CreateInstanceBackupResult, DataReference, DataTarget,
    DataVectorValue, InstanceBackupCatalogueSnapshot, InstanceBackupSnapshot,
    LogicalArchiveSnapshot, QueryExport, RestoreInstanceBackupResult, TransactionMutation,
    TransactionPreview,
};
use serde::Serialize;
use std::collections::BTreeMap;

/// What one mutation writes, in the form a preview or a change row renders.
#[derive(Debug, Clone, Serialize)]
pub struct MutationView {
    /// The mutation's wire name, such as `put_record` or `retire_data`.
    pub operation: String,
    /// What it writes: `kind:id` for a record, relation, vector, sample, geo
    /// value or object; the event kind for an event; `schema` for the registry.
    pub target: String,
    /// The other end it attaches to, when it has one: a relation's
    /// `from → to`, or the subject of an event, vector, geo value or object.
    pub subject: Option<String>,
    /// Display values of what it sets, bounded like every other property.
    pub properties: BTreeMap<String, String>,
}

/// The read-your-writes snapshot the engine computed for a preview: its read
/// stamp and size. Its entries stay native.
#[derive(Debug, Serialize)]
pub struct ProspectiveView {
    pub valid_at_unix_ms: u64,
    pub known_at_cursor: u64,
    pub schema_revision: u64,
    pub read_manifest_sha256: String,
    pub selected_versions: u64,
    pub keys_examined: u64,
    pub entries: usize,
}

/// A previewed change waiting for the operator: commit it by `handle` and the
/// `operation_sha256` shown here, or discard it.
#[derive(Debug, Serialize)]
pub struct ChangePreviewView {
    /// Opaque to the webview; names the pending change in this process only.
    pub handle: String,
    pub operation_sha256: String,
    pub read_cursor: u64,
    pub mutations: Vec<MutationView>,
    pub prospective: ProspectiveView,
    /// How long the engine keeps the preview open for its commit.
    pub timeout_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct CommitReceiptView {
    pub operation_sha256: String,
    pub mutation_count: u64,
    pub first_claim_sequence: u64,
    pub last_claim_sequence: u64,
    pub runtime_commit_sha256: Option<String>,
    pub first_runtime_cursor: Option<u64>,
    pub last_runtime_cursor: Option<u64>,
    /// The engine answered with the receipt of a commit it had already made.
    pub idempotent_replay: bool,
}

#[derive(Debug, Serialize)]
pub struct ArchiveView {
    pub archive_sha256: String,
    pub action_count: u64,
    pub standalone_claims: u64,
    pub runtime_commits: u64,
    pub runtime_mutations: u64,
    pub payload_bytes: u64,
    pub claim_sequence: u64,
    pub runtime_cursor: u64,
}

/// How a backup carries one family of estate state.
#[derive(Debug, Serialize)]
pub struct CoverageView {
    pub family: &'static str,
    /// `included`, `referenced_only`, `rebuild_required` or `excluded`.
    pub coverage: String,
}

#[derive(Debug, Serialize)]
pub struct BackupView {
    pub backup_sha256: String,
    pub label: String,
    pub created_at_unix_ms: u64,
    pub application_complete: bool,
    pub archive: ArchiveView,
    pub coverage: Vec<CoverageView>,
}

#[derive(Debug, Serialize)]
pub struct BackupsView {
    pub revision: u64,
    pub catalogue_sha256: String,
    /// The engine re-verified every archive for this read.
    pub archives_verified: bool,
    pub backups: Vec<BackupView>,
}

#[derive(Debug, Serialize)]
pub struct BackupCreatedView {
    pub backup: BackupView,
    pub catalogue_revision: u64,
    pub catalogue_sha256: String,
    pub idempotent_replay: bool,
}

/// A backup restored into its own verified staging root beside the estate.
/// The serving estate is not replaced.
#[derive(Debug, Serialize)]
pub struct RestoreView {
    pub backup_sha256: String,
    pub restore_id: String,
    pub inventory: ArchiveView,
    pub reopened: bool,
    pub idempotent_replay: bool,
}

/// A verified export the native process holds until the operator saves it.
#[derive(Debug, Serialize)]
pub struct ArtifactView {
    /// Opaque to the webview; names the held artifact in this process only.
    pub handle: String,
    pub media_type: String,
    /// The file name the save dialog suggests.
    pub file_name: String,
    pub bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Serialize)]
pub struct QueryExportView {
    pub artifact: ArtifactView,
    pub profile: String,
    pub canonical_query: String,
    pub known_at_cursor: u64,
    pub schema_revision: u64,
    pub read_manifest_sha256: String,
    pub rows: u64,
    pub columns: u64,
    pub row_groups: u64,
    pub elapsed_micros: u64,
}

#[derive(Debug, Serialize)]
pub struct AuditExportView {
    pub artifact: ArtifactView,
    pub requested_after_sequence: u64,
    pub through_sequence: u64,
    pub record_count: u16,
    pub chain_anchor_sha256: Option<String>,
    pub chain_head_sha256: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SavedArtifactView {
    pub path: String,
    pub bytes: u64,
    pub sha256: String,
}

fn key(reference: &DataReference) -> String {
    format!("{}:{}", reference.kind.as_str(), reference.id.as_str())
}

fn data_target(target: &DataTarget) -> String {
    match target {
        DataTarget::Reference { reference } => key(reference),
        DataTarget::Event { kind, cursor } => format!("{}@{cursor}", kind.as_str()),
    }
}

fn vector_shape(value: &DataVectorValue) -> String {
    match value {
        DataVectorValue::Dense { values } => format!("dense, {} dimensions", values.len()),
        DataVectorValue::Sparse {
            dimensions,
            indices,
            ..
        } => format!("sparse, {} of {dimensions} dimensions", indices.len()),
        DataVectorValue::MultiDense {
            dimensions,
            vectors,
        } => format!("{} vectors of {dimensions} dimensions", vectors.len()),
    }
}

fn with(
    mut properties: BTreeMap<String, String>,
    entries: impl IntoIterator<Item = (&'static str, String)>,
) -> BTreeMap<String, String> {
    for (name, value) in entries {
        properties.insert(name.into(), bounded(value));
    }
    properties
}

pub fn mutation(mutation: &TransactionMutation) -> MutationView {
    let view =
        |operation: &str, target: String, subject: Option<String>, properties| MutationView {
            operation: operation.into(),
            target,
            subject,
            properties,
        };
    match mutation {
        TransactionMutation::AssertClaim {
            subject,
            predicate,
            object,
            producer,
            ..
        } => view(
            "assert_claim",
            format!("{} {}", subject.as_str(), predicate.as_str()),
            None,
            with(
                BTreeMap::new(),
                [
                    ("object", object.clone()),
                    ("producer", producer.as_str().into()),
                ],
            ),
        ),
        TransactionMutation::PutSchema { registry } => view(
            "put_schema",
            "schema".into(),
            None,
            with(
                BTreeMap::new(),
                [
                    ("revision", registry.revision.to_string()),
                    ("migration", registry.migration.clone()),
                    ("tables", registry.tables.len().to_string()),
                ],
            ),
        ),
        TransactionMutation::PutRecord {
            reference,
            properties,
            ..
        } => view(
            "put_record",
            key(reference),
            None,
            display_properties(properties),
        ),
        TransactionMutation::PutRelation {
            reference,
            from,
            to,
            properties,
            ..
        } => view(
            "put_relation",
            key(reference),
            Some(format!("{} → {}", key(from), key(to))),
            display_properties(properties),
        ),
        TransactionMutation::AppendEvent {
            kind,
            subject,
            properties,
        } => view(
            "append_event",
            kind.as_str().into(),
            subject.as_ref().map(key),
            display_properties(properties),
        ),
        TransactionMutation::PutVector {
            reference,
            subject,
            collection_id,
            vector_name,
            value,
            properties,
            ..
        } => view(
            "put_vector",
            key(reference),
            Some(key(subject)),
            with(
                display_properties(properties),
                [
                    ("collection", collection_id.as_str().into()),
                    ("vector", vector_name.as_str().into()),
                    ("value", vector_shape(value)),
                ],
            ),
        ),
        TransactionMutation::AppendSeriesSample {
            reference,
            series,
            observed_at,
            value,
            properties,
        } => view(
            "append_series_sample",
            key(reference),
            Some(key(series)),
            with(
                display_properties(properties),
                [
                    ("observed_at", observed_at.to_string()),
                    ("value", label(value)),
                ],
            ),
        ),
        TransactionMutation::PutGeo {
            reference,
            subject,
            field,
            value,
            properties,
            ..
        } => view(
            "put_geo",
            key(reference),
            Some(key(subject)),
            with(
                display_properties(properties),
                [("field", field.as_str().into()), ("value", label(value))],
            ),
        ),
        TransactionMutation::PublishObjectReference {
            reference,
            subject,
            sha256,
            length,
            media_type,
            properties,
            ..
        } => view(
            "publish_object_reference",
            key(reference),
            subject.as_ref().map(key),
            with(
                display_properties(properties),
                [
                    ("sha256", sha256.clone()),
                    ("length", length.to_string()),
                    ("media_type", media_type.clone()),
                ],
            ),
        ),
        TransactionMutation::RetireData {
            model,
            target,
            effective_at,
        } => view(
            "retire_data",
            data_target(target),
            None,
            with(
                BTreeMap::new(),
                [
                    ("model", label(model)),
                    ("effective_at", effective_at.to_string()),
                ],
            ),
        ),
    }
}

pub fn preview(handle: String, preview: &TransactionPreview, timeout_ms: u64) -> ChangePreviewView {
    let prospective = &preview.prospective;
    ChangePreviewView {
        handle,
        operation_sha256: preview.operation_sha256.clone(),
        read_cursor: preview.read_cursor,
        mutations: preview.mutations.iter().map(mutation).collect(),
        prospective: ProspectiveView {
            valid_at_unix_ms: prospective.valid_at,
            known_at_cursor: prospective.known_at_cursor,
            schema_revision: prospective.schema_revision,
            read_manifest_sha256: prospective.read_manifest_sha256.clone(),
            selected_versions: prospective.selected_versions,
            keys_examined: prospective.read_evidence.keys_examined,
            entries: prospective.entries.len(),
        },
        timeout_ms,
    }
}

pub fn receipt(receipt: &CommitReceipt) -> CommitReceiptView {
    CommitReceiptView {
        operation_sha256: receipt.operation_sha256.clone(),
        mutation_count: receipt.mutation_count,
        first_claim_sequence: receipt.first_claim_sequence,
        last_claim_sequence: receipt.last_claim_sequence,
        runtime_commit_sha256: receipt.runtime_commit_sha256.clone(),
        first_runtime_cursor: receipt.first_runtime_cursor,
        last_runtime_cursor: receipt.last_runtime_cursor,
        idempotent_replay: receipt.idempotent_replay,
    }
}

fn archive(archive: &LogicalArchiveSnapshot) -> ArchiveView {
    ArchiveView {
        archive_sha256: archive.archive_sha256.clone(),
        action_count: archive.action_count,
        standalone_claims: archive.standalone_claims,
        runtime_commits: archive.runtime_commits,
        runtime_mutations: archive.runtime_mutations,
        payload_bytes: archive.payload_bytes,
        claim_sequence: archive.claim_sequence,
        runtime_cursor: archive.runtime_cursor,
    }
}

fn backup(backup: &InstanceBackupSnapshot) -> BackupView {
    let coverage = [
        ("claims", &backup.claims),
        ("typed_runtime", &backup.typed_runtime),
        ("catalogues", &backup.catalogues),
        ("installed_control", &backup.installed_control),
        ("object_payloads", &backup.object_payloads),
        ("projections", &backup.projections),
        ("invocation_telemetry", &backup.invocation_telemetry),
        ("snapshot_leases", &backup.snapshot_leases),
    ]
    .into_iter()
    .map(|(family, coverage)| CoverageView {
        family,
        coverage: label(coverage),
    })
    .collect();
    BackupView {
        backup_sha256: backup.backup_sha256.clone(),
        label: backup.label.clone(),
        created_at_unix_ms: backup.created_at_unix_ms,
        application_complete: backup.application_complete,
        archive: archive(&backup.archive),
        coverage,
    }
}

pub fn backups(catalogue: &InstanceBackupCatalogueSnapshot) -> BackupsView {
    BackupsView {
        revision: catalogue.revision,
        catalogue_sha256: catalogue.catalogue_sha256.clone(),
        archives_verified: catalogue.archives_verified,
        backups: catalogue.backups.iter().map(backup).collect(),
    }
}

pub fn backup_created(result: &CreateInstanceBackupResult) -> BackupCreatedView {
    BackupCreatedView {
        backup: backup(&result.backup),
        catalogue_revision: result.catalogue_revision,
        catalogue_sha256: result.catalogue_sha256.clone(),
        idempotent_replay: result.idempotent_replay,
    }
}

pub fn restore(result: &RestoreInstanceBackupResult) -> RestoreView {
    RestoreView {
        backup_sha256: result.backup_sha256.clone(),
        restore_id: result.restore_id.as_str().into(),
        inventory: archive(&result.inventory),
        reopened: result.reopened,
        idempotent_replay: result.idempotent_replay,
    }
}

pub fn query_export(artifact: ArtifactView, export: &QueryExport) -> QueryExportView {
    QueryExportView {
        artifact,
        profile: export.profile.clone(),
        canonical_query: export.source.canonical_query.clone(),
        known_at_cursor: export.source.known_at_cursor,
        schema_revision: export.source.schema_revision,
        read_manifest_sha256: export.source.read_manifest_sha256.clone(),
        rows: export.source.execution.returned_rows,
        columns: export.columns,
        row_groups: export.row_groups,
        elapsed_micros: export.elapsed_micros,
    }
}

pub fn audit_export(artifact: ArtifactView, export: &AuditExport) -> AuditExportView {
    AuditExportView {
        artifact,
        requested_after_sequence: export.requested_after_sequence,
        through_sequence: export.through_sequence,
        record_count: export.record_count,
        chain_anchor_sha256: export.chain_anchor_sha256.clone(),
        chain_head_sha256: export.chain_head_sha256.clone(),
    }
}
