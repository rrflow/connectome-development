//! Views of how the engine answered a query: the plan it bound and what the
//! execution read.
//!
//! Every field is the engine's own `QueryResult` evidence, which the SDK
//! validated before Connectome projects it. Nothing here is derived or
//! estimated by Connectome.

use super::label;
use rrd_contract::{
    QueryExecutionAnalysisSnapshot, QueryExecutionSnapshot, QueryPlanCandidate, QueryPlanSnapshot,
    ReadEvidence, ReadPathEvidence,
};
use serde::Serialize;

/// One access path the engine considered for the query.
#[derive(Debug, Serialize)]
pub struct QueryPlanCandidateView {
    pub name: String,
    pub selected: bool,
    pub exact: bool,
    /// The engine's own words for choosing or rejecting this path.
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct QueryPlanView {
    pub plan_sha256: String,
    /// Zero denotes an explicitly unsecured loopback development engine.
    pub security_policy_revision: u64,
    pub authorization_sha256: String,
    pub exact: bool,
    pub deterministic_order: String,
    pub authorization_boundary: String,
    pub candidates: Vec<QueryPlanCandidateView>,
}

/// Logical reads attributed to one access path.
#[derive(Debug, Serialize)]
pub struct QueryReadPathView {
    pub path: String,
    pub point_reads: u64,
    pub range_scans: u64,
    pub keys_examined: u64,
    pub values_decoded: u64,
    pub decoded_bytes: u64,
}

/// The engine's complete logical read evidence for the query.
#[derive(Debug, Serialize)]
pub struct QueryReadEvidenceView {
    pub contract_version: u16,
    pub key_budget: u64,
    pub point_reads: u64,
    pub range_scans: u64,
    pub keys_examined: u64,
    pub values_decoded: u64,
    pub decoded_bytes: u64,
    pub stamp_validation_method: String,
    pub stamp_validation_change_reads: u64,
    pub stamp_validation_proof_nodes: u16,
    pub paths: Vec<QueryReadPathView>,
}

/// Physical execution counters the engine reports only when it analysed the
/// run.
#[derive(Debug, Serialize)]
pub struct QueryAnalysisView {
    pub engine: String,
    pub provider_scans: u64,
    pub input_rows: u64,
    pub input_batches: u64,
    pub input_memory_bytes: u64,
    pub output_batches: u64,
    pub projection_pushdown: String,
    pub filter_pushdown: String,
    pub limit_pushdown: String,
    pub physical_operators: u64,
    pub peak_memory_bytes: u64,
    pub spill_count: u64,
    pub spilled_bytes: u64,
    pub spilled_rows: u64,
    pub elapsed_micros: u64,
}

#[derive(Debug, Serialize)]
pub struct QueryExecutionView {
    pub selected_versions: u64,
    pub read_evidence: QueryReadEvidenceView,
    pub returned_rows: u64,
    pub output_bytes: u64,
    pub truncated: bool,
    pub analysis: Option<QueryAnalysisView>,
}

fn candidate(candidate: &QueryPlanCandidate) -> QueryPlanCandidateView {
    QueryPlanCandidateView {
        name: candidate.name.clone(),
        selected: candidate.selected,
        exact: candidate.exact,
        reason: candidate.reason.clone(),
    }
}

pub fn plan(plan: &QueryPlanSnapshot) -> QueryPlanView {
    QueryPlanView {
        plan_sha256: plan.plan_sha256.clone(),
        security_policy_revision: plan.security_policy_revision,
        authorization_sha256: plan.authorization_sha256.clone(),
        exact: plan.exact,
        deterministic_order: plan.deterministic_order.clone(),
        authorization_boundary: plan.authorization_boundary.clone(),
        candidates: plan.candidates.iter().map(candidate).collect(),
    }
}

fn read_path(path: &ReadPathEvidence) -> QueryReadPathView {
    QueryReadPathView {
        path: label(&path.path),
        point_reads: path.point_reads,
        range_scans: path.range_scans,
        keys_examined: path.keys_examined,
        values_decoded: path.values_decoded,
        decoded_bytes: path.decoded_bytes,
    }
}

fn read_evidence(evidence: &ReadEvidence) -> QueryReadEvidenceView {
    QueryReadEvidenceView {
        contract_version: evidence.contract_version,
        key_budget: evidence.key_budget,
        point_reads: evidence.point_reads,
        range_scans: evidence.range_scans,
        keys_examined: evidence.keys_examined,
        values_decoded: evidence.values_decoded,
        decoded_bytes: evidence.decoded_bytes,
        stamp_validation_method: label(&evidence.stamp_validation.method),
        stamp_validation_change_reads: evidence.stamp_validation.change_reads,
        stamp_validation_proof_nodes: evidence.stamp_validation.proof_nodes,
        paths: evidence.paths.iter().map(read_path).collect(),
    }
}

fn analysis(analysis: &QueryExecutionAnalysisSnapshot) -> QueryAnalysisView {
    QueryAnalysisView {
        engine: analysis.engine.clone(),
        provider_scans: analysis.provider_scans,
        input_rows: analysis.input_rows,
        input_batches: analysis.input_batches,
        input_memory_bytes: analysis.input_memory_bytes,
        output_batches: analysis.output_batches,
        projection_pushdown: analysis.projection_pushdown.clone(),
        filter_pushdown: analysis.filter_pushdown.clone(),
        limit_pushdown: analysis.limit_pushdown.clone(),
        physical_operators: analysis.physical_operators,
        peak_memory_bytes: analysis.peak_memory_bytes,
        spill_count: analysis.spill_count,
        spilled_bytes: analysis.spilled_bytes,
        spilled_rows: analysis.spilled_rows,
        elapsed_micros: analysis.elapsed_micros,
    }
}

pub fn execution(execution: &QueryExecutionSnapshot) -> QueryExecutionView {
    QueryExecutionView {
        selected_versions: execution.selected_versions,
        read_evidence: read_evidence(&execution.read_evidence),
        returned_rows: execution.returned_rows,
        output_bytes: execution.output_bytes,
        truncated: execution.truncated,
        analysis: execution.analysis.as_ref().map(analysis),
    }
}

#[cfg(test)]
mod tests {
    use super::super::query;
    use rrd_contract::QueryResult;
    use serde_json::json;

    fn result() -> QueryResult {
        serde_json::from_value(json!({
            "canonical_query": "FROM record:document",
            "scope": "project:fixture",
            "read_manifest_sha256": "b".repeat(64),
            "known_at_cursor": 7,
            "result_identity_version": 1,
            "schema_revision": 3,
            "plan": {
                "plan_sha256": "c".repeat(64),
                "security_policy_revision": 2,
                "authorization_sha256": "d".repeat(64),
                "exact": true,
                "deterministic_order": "identity_ascending",
                "authorization_boundary": "allowed_fields_and_rows",
                "candidates": [
                    {
                        "name": "record_scan",
                        "selected": true,
                        "exact": true,
                        "reason": "no index covers the filter"
                    },
                    {
                        "name": "secondary_index",
                        "selected": false,
                        "exact": true,
                        "reason": "no ready index"
                    }
                ]
            },
            "execution": {
                "selected_versions": 5,
                "read_evidence": {
                    "contract_version": 1,
                    "key_budget": 10000,
                    "point_reads": 0,
                    "range_scans": 1,
                    "keys_examined": 5,
                    "values_decoded": 5,
                    "decoded_bytes": 64,
                    "stamp_validation": {
                        "method": "authenticated_current_head",
                        "change_reads": 0,
                        "proof_nodes": 0
                    },
                    "paths": [
                        {
                            "path": "record_versions",
                            "point_reads": 0,
                            "range_scans": 1,
                            "keys_examined": 5,
                            "values_decoded": 5,
                            "decoded_bytes": 64
                        }
                    ]
                },
                "returned_rows": 0,
                "output_bytes": 256,
                "truncated": false,
                "analysis": null
            },
            "rows": []
        }))
        .expect("typed QueryResult fixture")
    }

    #[test]
    fn query_view_carries_the_engine_plan_and_execution() {
        let view = query(&result());

        assert!(view.plan.exact);
        assert_eq!(view.plan.security_policy_revision, 2);
        assert_eq!(view.plan.deterministic_order, "identity_ascending");
        assert_eq!(view.plan.authorization_boundary, "allowed_fields_and_rows");
        let candidates: Vec<(&str, bool, &str)> = view
            .plan
            .candidates
            .iter()
            .map(|candidate| {
                (
                    candidate.name.as_str(),
                    candidate.selected,
                    candidate.reason.as_str(),
                )
            })
            .collect();
        assert_eq!(
            candidates,
            [
                ("record_scan", true, "no index covers the filter"),
                ("secondary_index", false, "no ready index"),
            ]
        );

        assert_eq!(view.execution.selected_versions, 5);
        assert_eq!(view.execution.output_bytes, 256);
        assert!(!view.execution.truncated);
        assert!(view.execution.analysis.is_none());
        let evidence = &view.execution.read_evidence;
        assert_eq!(
            evidence.stamp_validation_method,
            "authenticated_current_head"
        );
        assert_eq!(evidence.paths.len(), 1);
        assert_eq!(evidence.paths[0].path, "record_versions");
        assert_eq!(evidence.paths[0].range_scans, 1);
    }
}
