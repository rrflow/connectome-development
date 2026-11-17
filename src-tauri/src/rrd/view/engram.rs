//! View of the installed engram's authority record: its instances with what
//! was asked of them and what was last observed, and the lifecycle operations
//! recorded against them.
//!
//! The engine contract still names this "estate" (`EstateSnapshot`, read with
//! `estate-read`); Connectome presents it as an engram. Every field is the
//! engine's own; nothing is derived except the string form of its
//! enumerations.

use super::label;
use rrd_contract::{
    EstateAuthorityReceiptSnapshot, EstateAuthorityResourceSnapshot, EstateInstanceSnapshot,
    EstateOperationSnapshot, EstateSnapshot,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct EngramActivityPolicyView {
    pub idle_after_ms: u64,
    pub stale_after_ms: u64,
    pub neglected_after_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct EngramAuthorityDesiredView {
    pub generation: u64,
    pub spec_sha256: String,
    pub updated_at_unix_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct EngramAuthorityObservedView {
    pub generation: u64,
    /// `pending`, `ready`, `degraded`, `failed` or `retired`.
    pub status: String,
    pub observed_at_unix_ms: u64,
    pub evidence_sha256: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EngramAuthorityResourceView {
    pub id: String,
    /// The resource kind, such as `project`, `instance` or `node`.
    pub kind: String,
    pub parent_ids: Vec<String>,
    pub name: String,
    pub spec_sha256: String,
    pub desired: Option<EngramAuthorityDesiredView>,
    pub observed: Option<EngramAuthorityObservedView>,
    pub secret_reference_ids: Vec<String>,
    pub created_at_unix_ms: u64,
    pub updated_at_unix_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct EngramAuthorityReceiptView {
    pub id: String,
    pub resource_id: String,
    pub operation_id: String,
    pub lease_epoch: u64,
    /// `desired_accepted`, `assigned`, `applied`, `observed`, `completed` or `failed`.
    pub boundary: String,
    pub at_unix_ms: u64,
    pub evidence_sha256: String,
}

#[derive(Debug, Serialize)]
pub struct EngramAuthorityView {
    pub catalogue_sha256: String,
    pub resources: Vec<EngramAuthorityResourceView>,
    pub receipts: Vec<EngramAuthorityReceiptView>,
    pub idempotency_binding_count: u32,
}

#[derive(Debug, Serialize)]
pub struct EngramDesiredView {
    pub generation: u64,
    /// `running`, `stopped` or `absent`.
    pub phase: String,
    pub deployment_ref: String,
    pub version: String,
    pub configuration_sha256: String,
    pub updated_at_unix_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct EngramObservedView {
    pub generation: u64,
    /// `unknown`, `provisioning`, `starting`, `running`, `stopping`, `stopped`,
    /// `deleting`, `absent` or `failed`.
    pub phase: String,
    pub version: Option<String>,
    pub process_id: Option<u32>,
    pub observed_at_unix_ms: u64,
    pub evidence_sha256: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EngramActivityView {
    pub last_meaningful_runtime_at_unix_ms: Option<u64>,
    pub last_heartbeat_at_unix_ms: Option<u64>,
    /// `unknown`, `active`, `idle`, `stale` or `neglected`.
    pub class: String,
    pub evaluated_at_unix_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct EngramInstanceView {
    pub id: String,
    pub desired: EngramDesiredView,
    pub observed: EngramObservedView,
    pub activity: EngramActivityView,
}

#[derive(Debug, Serialize)]
pub struct EngramLeaseView {
    pub owner: String,
    pub epoch: u64,
    pub acquired_at_unix_ms: u64,
    pub expires_at_unix_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct EngramReceiptView {
    /// `prepared`, `applied`, `completed` or `failed`.
    pub boundary: String,
    pub lease_epoch: u64,
    pub at_unix_ms: u64,
    pub evidence_sha256: String,
}

#[derive(Debug, Serialize)]
pub struct EngramOperationView {
    pub id: String,
    pub instance_id: String,
    /// `provision`, `start`, `stop`, `restart`, `upgrade` or `delete`.
    pub kind: String,
    pub desired_generation: u64,
    pub request_sha256: String,
    /// `pending`, `leased`, `prepared`, `applied`, `succeeded`, `failed` or
    /// `superseded`.
    pub state: String,
    pub attempts: u32,
    pub created_at_unix_ms: u64,
    pub updated_at_unix_ms: u64,
    pub lease: Option<EngramLeaseView>,
    pub receipts: Vec<EngramReceiptView>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EngramView {
    pub format_version: u16,
    pub id: String,
    pub revision: u64,
    pub created_at_unix_ms: u64,
    pub updated_at_unix_ms: u64,
    pub activity_policy: EngramActivityPolicyView,
    pub authority: EngramAuthorityView,
    pub instances: Vec<EngramInstanceView>,
    /// In the engine's own order; the webview sorts them for display.
    pub operations: Vec<EngramOperationView>,
    pub idempotency_binding_count: u32,
}

fn resource(resource: &EstateAuthorityResourceSnapshot) -> EngramAuthorityResourceView {
    EngramAuthorityResourceView {
        id: resource.id.as_str().into(),
        kind: label(&resource.kind),
        parent_ids: resource
            .parent_ids
            .iter()
            .map(|id| id.as_str().into())
            .collect(),
        name: resource.name.clone(),
        spec_sha256: resource.spec_sha256.clone(),
        desired: resource
            .desired
            .as_ref()
            .map(|desired| EngramAuthorityDesiredView {
                generation: desired.generation,
                spec_sha256: desired.spec_sha256.clone(),
                updated_at_unix_ms: desired.updated_at_unix_ms,
            }),
        observed: resource
            .observed
            .as_ref()
            .map(|observed| EngramAuthorityObservedView {
                generation: observed.generation,
                status: label(&observed.status),
                observed_at_unix_ms: observed.observed_at_unix_ms,
                evidence_sha256: observed.evidence_sha256.clone(),
                error: observed.error.clone(),
            }),
        secret_reference_ids: resource
            .secret_reference_ids
            .iter()
            .map(|id| id.as_str().into())
            .collect(),
        created_at_unix_ms: resource.created_at_unix_ms,
        updated_at_unix_ms: resource.updated_at_unix_ms,
    }
}

fn authority_receipt(receipt: &EstateAuthorityReceiptSnapshot) -> EngramAuthorityReceiptView {
    EngramAuthorityReceiptView {
        id: receipt.id.as_str().into(),
        resource_id: receipt.resource_id.as_str().into(),
        operation_id: receipt.operation_id.as_str().into(),
        lease_epoch: receipt.lease_epoch,
        boundary: label(&receipt.boundary),
        at_unix_ms: receipt.at_unix_ms,
        evidence_sha256: receipt.evidence_sha256.clone(),
    }
}

fn instance(instance: &EstateInstanceSnapshot) -> EngramInstanceView {
    EngramInstanceView {
        id: instance.id.as_str().into(),
        desired: EngramDesiredView {
            generation: instance.desired.generation,
            phase: label(&instance.desired.phase),
            deployment_ref: instance.desired.deployment_ref.as_str().into(),
            version: instance.desired.version.clone(),
            configuration_sha256: instance.desired.configuration_sha256.clone(),
            updated_at_unix_ms: instance.desired.updated_at_unix_ms,
        },
        observed: EngramObservedView {
            generation: instance.observed.generation,
            phase: label(&instance.observed.phase),
            version: instance.observed.version.clone(),
            process_id: instance.observed.process_id,
            observed_at_unix_ms: instance.observed.observed_at_unix_ms,
            evidence_sha256: instance.observed.evidence_sha256.clone(),
            error: instance.observed.error.clone(),
        },
        activity: EngramActivityView {
            last_meaningful_runtime_at_unix_ms: instance
                .activity
                .last_meaningful_runtime_at_unix_ms,
            last_heartbeat_at_unix_ms: instance.activity.last_heartbeat_at_unix_ms,
            class: label(&instance.activity.class),
            evaluated_at_unix_ms: instance.activity.evaluated_at_unix_ms,
        },
    }
}

fn operation(operation: &EstateOperationSnapshot) -> EngramOperationView {
    EngramOperationView {
        id: operation.id.as_str().into(),
        instance_id: operation.instance_id.as_str().into(),
        kind: label(&operation.kind),
        desired_generation: operation.desired_generation,
        request_sha256: operation.request_sha256.clone(),
        state: label(&operation.state),
        attempts: operation.attempts,
        created_at_unix_ms: operation.created_at_unix_ms,
        updated_at_unix_ms: operation.updated_at_unix_ms,
        lease: operation.lease.as_ref().map(|lease| EngramLeaseView {
            owner: lease.owner.as_str().into(),
            epoch: lease.epoch,
            acquired_at_unix_ms: lease.acquired_at_unix_ms,
            expires_at_unix_ms: lease.expires_at_unix_ms,
        }),
        receipts: operation
            .receipts
            .iter()
            .map(|receipt| EngramReceiptView {
                boundary: label(&receipt.boundary),
                lease_epoch: receipt.lease_epoch,
                at_unix_ms: receipt.at_unix_ms,
                evidence_sha256: receipt.evidence_sha256.clone(),
            })
            .collect(),
        error: operation.error.clone(),
    }
}

pub fn engram(snapshot: &EstateSnapshot) -> EngramView {
    EngramView {
        format_version: snapshot.format_version,
        id: snapshot.id.as_str().into(),
        revision: snapshot.revision,
        created_at_unix_ms: snapshot.created_at_unix_ms,
        updated_at_unix_ms: snapshot.updated_at_unix_ms,
        activity_policy: EngramActivityPolicyView {
            idle_after_ms: snapshot.activity_policy.idle_after_ms,
            stale_after_ms: snapshot.activity_policy.stale_after_ms,
            neglected_after_ms: snapshot.activity_policy.neglected_after_ms,
        },
        authority: EngramAuthorityView {
            catalogue_sha256: snapshot.authority.catalogue_sha256.clone(),
            resources: snapshot.authority.resources.iter().map(resource).collect(),
            receipts: snapshot
                .authority
                .receipts
                .iter()
                .map(authority_receipt)
                .collect(),
            idempotency_binding_count: snapshot.authority.idempotency_binding_count,
        },
        instances: snapshot.instances.iter().map(instance).collect(),
        operations: snapshot.operations.iter().map(operation).collect(),
        idempotency_binding_count: snapshot.idempotency_binding_count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// A snapshot in the engine's wire form, decoded by the contract.
    fn snapshot() -> EstateSnapshot {
        let digest = "a".repeat(64);
        serde_json::from_value(json!({
            "format_version": 1,
            "id": "engram-a",
            "revision": 4,
            "created_at_unix_ms": 1_000,
            "updated_at_unix_ms": 4_000,
            "activity_policy": {
                "idle_after_ms": 60_000,
                "stale_after_ms": 600_000,
                "neglected_after_ms": 6_000_000
            },
            "authority": {
                "catalogue_sha256": digest,
                "resources": [{
                    "id": "node-a",
                    "kind": "node",
                    "parent_ids": ["project-a"],
                    "name": "first node",
                    "spec_sha256": digest,
                    "observed": {
                        "generation": 2,
                        "status": "degraded",
                        "observed_at_unix_ms": 3_500,
                        "evidence_sha256": digest,
                        "error": "disk nearly full"
                    },
                    "created_at_unix_ms": 1_000,
                    "updated_at_unix_ms": 3_500
                }],
                "receipts": [{
                    "id": "receipt-a",
                    "resource_id": "node-a",
                    "operation_id": "operation-a",
                    "lease_epoch": 1,
                    "boundary": "desired_accepted",
                    "at_unix_ms": 3_000,
                    "evidence_sha256": digest
                }],
                "idempotency_binding_count": 1
            },
            "instances": [{
                "id": "instance-a",
                "desired": {
                    "generation": 2,
                    "phase": "running",
                    "deployment_ref": "deployment-a",
                    "version": "1.0.0",
                    "configuration_sha256": digest,
                    "updated_at_unix_ms": 2_000
                },
                "observed": {
                    "generation": 2,
                    "phase": "running",
                    "process_id": 4_242,
                    "observed_at_unix_ms": 3_900
                },
                "activity": {
                    "last_heartbeat_at_unix_ms": 3_900,
                    "class": "active",
                    "evaluated_at_unix_ms": 4_000
                }
            }],
            "operations": [{
                "id": "operation-a",
                "instance_id": "instance-a",
                "kind": "start",
                "desired_generation": 2,
                "request_sha256": digest,
                "state": "succeeded",
                "attempts": 1,
                "created_at_unix_ms": 2_000,
                "updated_at_unix_ms": 2_500,
                "lease": {
                    "owner": "worker-a",
                    "epoch": 1,
                    "acquired_at_unix_ms": 2_100,
                    "expires_at_unix_ms": 2_900
                },
                "receipts": [{
                    "boundary": "completed",
                    "lease_epoch": 1,
                    "at_unix_ms": 2_500,
                    "evidence_sha256": digest
                }]
            }],
            "idempotency_binding_count": 3
        }))
        .expect("snapshot in the contract's wire form")
    }

    #[test]
    fn engram_view_projects_every_snapshot_field() {
        let view = engram(&snapshot());
        assert_eq!(view.format_version, 1);
        assert_eq!(view.id, "engram-a");
        assert_eq!(view.revision, 4);
        assert_eq!(
            (view.created_at_unix_ms, view.updated_at_unix_ms),
            (1_000, 4_000)
        );
        assert_eq!(view.activity_policy.stale_after_ms, 600_000);
        assert_eq!(view.idempotency_binding_count, 3);

        assert_eq!(view.authority.idempotency_binding_count, 1);
        let resource = &view.authority.resources[0];
        assert_eq!(resource.kind, "node");
        assert_eq!(resource.parent_ids, ["project-a"]);
        assert!(resource.desired.is_none());
        let observed = resource.observed.as_ref().expect("observed resource");
        assert_eq!(observed.status, "degraded");
        assert_eq!(observed.error.as_deref(), Some("disk nearly full"));
        assert_eq!(view.authority.receipts[0].boundary, "desired_accepted");

        let instance = &view.instances[0];
        assert_eq!(instance.desired.phase, "running");
        assert_eq!(instance.desired.deployment_ref, "deployment-a");
        assert_eq!(instance.observed.phase, "running");
        assert_eq!(instance.observed.process_id, Some(4_242));
        assert!(instance.observed.version.is_none());
        assert_eq!(instance.activity.class, "active");
        assert!(instance
            .activity
            .last_meaningful_runtime_at_unix_ms
            .is_none());

        let operation = &view.operations[0];
        assert_eq!(operation.kind, "start");
        assert_eq!(operation.state, "succeeded");
        assert_eq!(operation.instance_id, "instance-a");
        assert_eq!(operation.lease.as_ref().expect("lease").owner, "worker-a");
        assert_eq!(operation.receipts[0].boundary, "completed");
        assert!(operation.error.is_none());
    }
}
