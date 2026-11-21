/*
 * What one rrflowQL read returns to the window: its rows, the plan the engine
 * bound, and what running that plan read.
 */

export interface RrdQueryRowView {
	identity: string;
	values: Record<string, string>;
}

export interface RrdQueryView {
	configuration?: import("../configuration").Admission | null;
	canonical_query: string;
	known_at_cursor: number;
	schema_revision: number;
	columns: string[];
	rows: RrdQueryRowView[];
	returned_rows: number;
	truncated: boolean;
	keys_examined: number;
	output_bytes: number;
	/** The plan the engine bound: every access path it considered. */
	plan: RrdQueryPlanView;
	/** What running that plan read and returned. */
	execution: RrdQueryExecutionView;
}

/** One access path the engine considered, with its own reason. */
export interface RrdQueryPlanCandidateView {
	name: string;
	selected: boolean;
	exact: boolean;
	reason: string;
}

export interface RrdQueryPlanView {
	plan_sha256: string;
	/** Zero denotes an explicitly unsecured loopback development engine. */
	security_policy_revision: number;
	authorization_sha256: string;
	exact: boolean;
	deterministic_order: string;
	authorization_boundary: string;
	candidates: RrdQueryPlanCandidateView[];
}

/** Logical reads the engine attributes to one access path. */
export interface RrdQueryReadPathView {
	path: string;
	point_reads: number;
	range_scans: number;
	keys_examined: number;
	values_decoded: number;
	decoded_bytes: number;
}

export interface RrdQueryReadEvidenceView {
	contract_version: number;
	key_budget: number;
	point_reads: number;
	range_scans: number;
	keys_examined: number;
	values_decoded: number;
	decoded_bytes: number;
	stamp_validation_method: string;
	stamp_validation_change_reads: number;
	stamp_validation_proof_nodes: number;
	paths: RrdQueryReadPathView[];
}

/** Physical execution counters, present only when the engine analysed the run. */
export interface RrdQueryAnalysisView {
	engine: string;
	provider_scans: number;
	input_rows: number;
	input_batches: number;
	input_memory_bytes: number;
	output_batches: number;
	projection_pushdown: string;
	filter_pushdown: string;
	limit_pushdown: string;
	physical_operators: number;
	peak_memory_bytes: number;
	spill_count: number;
	spilled_bytes: number;
	spilled_rows: number;
	elapsed_micros: number;
}

export interface RrdQueryExecutionView {
	selected_versions: number;
	read_evidence: RrdQueryReadEvidenceView;
	returned_rows: number;
	output_bytes: number;
	truncated: boolean;
	analysis: RrdQueryAnalysisView | null;
}
