/** Bounded native view projections. Integers that may exceed JS precision are strings. */
export interface TaskSummary {
	id: string;
	title: string;
	goal: string;
	status: string;
	cursor: string;
}
export interface TaskBudget {
	sha256: string;
	max_steps: string;
	max_step_elapsed_ms: string;
	max_run_elapsed_ms: string;
	reserved_steps: string;
	charged_elapsed_ms: string;
	started_at_unix_ms: string;
	deadline_unix_ms: string;
	active_attempt: string | null;
	execution_may_continue: boolean;
	stopped: string | null;
}
export interface TaskProposal {
	attempt_id: string;
	task_sha256: string;
	configuration_sha256: string;
	controller_binding_id: string;
	service_id: string;
	choice:
		| { kind: "select"; binding_id: string; effort: string | null }
		| { kind: "abstain"; reason: string };
	elapsed_ms: string | null;
	response_sha256: string;
}
export interface WorkerReview {
	selection_attempt_id: string;
	selection_sha256: string;
	task_sha256: string;
	configuration_sha256: string;
	binding_id: string;
	effort: string | null;
	wait_timeout_ms: string;
	source: WorkerSourceReview | null;
}
export interface TaskWorkerSourceRequest {
	contract_version: 1;
	entry_identity: string;
	expected_content_sha256: string;
	maximum_input_bytes: number;
}
export interface SourceCandidate {
	entry_identity: string;
	path: string;
	content_sha256: string;
	bytes: string;
}
export interface SourceInventory {
	entries: SourceCandidate[];
	read_cursor: string;
	read_manifest_sha256: string;
	result_identity_version: number;
	truncated: boolean;
	incomplete_rows: number;
	unavailable_rows: number;
	oversized_rows: number;
}
export interface WorkerSourceReview {
	request: TaskWorkerSourceRequest;
	path: string;
	bytes: string;
	read_cursor: string;
	read_manifest_sha256: string;
	result_identity_version: number;
}
export interface WorkerDraft {
	attempt_id: string;
	selection_attempt_id: string;
	binding_id: string;
	service_id: string;
	content: string;
	content_sha256: string;
	response_sha256: string;
	task_sha256: string;
	configuration_sha256: string;
	elapsed_ms: string | null;
	source: TaskWorkerSourceProvenance | null;
}
export interface TaskWorkerSourceProvenance {
	contract_version: number;
	captured_snapshot_sha256: string;
	captured_read: TaskWorkerReadStamp;
	project_id: string;
	entry_identity: string;
	path_sha256: string;
	content_sha256: string;
	policy_sha256: string;
	profile_sha256: string;
	captured_at_unix_ms: string;
	validated_snapshot_sha256: string;
	validated_read: TaskWorkerReadStamp;
	validated_at_unix_ms: string;
}
export interface TaskWorkerReadStamp {
	runtime_manifest_sha256: string;
	runtime_cursor: string;
	schema_revision: string | null;
	catalogue_revision: string;
}

/** Prevents a delayed native read from re-disclosing a cleared WorkerDraft. */
export class WorkerDraftCache {
	private generation = 0;
	private current: WorkerDraft | null = null;

	begin(clearCurrent = false): number {
		this.generation += 1;
		if (clearCurrent) this.current = null;
		return this.generation;
	}

	clear(): void {
		this.begin(true);
	}

	invalidate(): void {
		this.generation += 1;
	}

	isCurrent(generation: number): boolean {
		return generation === this.generation;
	}

	commit(generation: number, worker: WorkerDraft | null): boolean {
		if (!this.isCurrent(generation)) return false;
		this.current = worker;
		return true;
	}

	read(): WorkerDraft | null {
		return this.current;
	}
}
export type TaskCommand =
	| { action: "list"; after_cursor: string }
	| { action: "open"; title: string; goal: string }
	| { action: "read" | "budget" | "prepare"; task_id: string }
	| {
			action: "configure";
			task_id: string;
			limits: { max_steps: number; max_step_elapsed_ms: number; max_run_elapsed_ms: number };
	  }
	| { action: "stop" | "resume"; task_id: string; expected_budget_sha256: string }
	| {
			action: "propose";
			task_id: string;
			attempt_id: string;
			expected_task_sha256: string;
			expected_configuration_sha256: string;
	  }
	| { action: "sources"; task_id: string }
	| {
			action: "prepare_worker";
			task_id: string;
			selection_attempt_id: string;
			source?: TaskWorkerSourceRequest | null;
	  }
	| {
			action: "work";
			task_id: string;
			attempt_id: string;
			selection_attempt_id: string;
			expected_selection_sha256: string;
			expected_task_sha256: string;
			expected_configuration_sha256: string;
			source?: TaskWorkerSourceRequest | null;
	  }
	| { action: "attempt"; task_id: string; attempt_id: string };
export type TaskReply =
	| { kind: "not_dispatched"; reason: string }
	| { kind: "page"; tasks: TaskSummary[]; truncated: boolean; next_cursor: string }
	| { kind: "task"; task: TaskSummary }
	| { kind: "budget"; budget: TaskBudget | null }
	| {
			kind: "prepared";
			task: TaskSummary;
			task_sha256: string;
			configuration_sha256: string;
			controller: string | null;
			candidates: string[];
			wait_timeout_ms: string | null;
			unavailable: string | null;
	  }
	| { kind: "proposal"; proposal: TaskProposal }
	| { kind: "worker_prepared"; review: WorkerReview }
	| { kind: "sources"; inventory: SourceInventory }
	| { kind: "worker"; worker: WorkerDraft }
	| {
			kind: "attempt";
			status: "reserved" | "accepted" | "stopped" | "invalidated" | null;
			proposal: TaskProposal | null;
			worker: WorkerDraft | null;
	  };

/** Recovery metadata, never a cached outcome or permission to retry. */
export interface TaskRecovery {
	task_id: string;
	attempt_id: string;
}
export function readTaskRecovery(key: string): TaskRecovery | null {
	const text = localStorage.getItem(key);
	if (!text) return null;
	const value = JSON.parse(text) as TaskRecovery;
	if (
		typeof value.task_id !== "string" ||
		typeof value.attempt_id !== "string" ||
		value.task_id.length > 256 ||
		value.attempt_id.length > 256
	) {
		throw new Error(
			"Stored recovery coordinates are invalid; use the recorded task and attempt IDs",
		);
	}
	return value;
}
