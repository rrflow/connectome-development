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
export type TaskCommand =
	| { action: "list"; after_cursor: string }
	| { action: "open"; title: string; goal: string }
	| { action: "read" | "budget" | "prepare"; task_id: string }
	| {
			action: "configure";
			task_id: string;
			limits: { max_steps: number; max_step_elapsed_ms: number; max_run_elapsed_ms: number };
	  }
	| { action: "stop"; task_id: string; expected_budget_sha256: string }
	| {
			action: "propose";
			task_id: string;
			attempt_id: string;
			expected_task_sha256: string;
			expected_configuration_sha256: string;
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
	| {
			kind: "attempt";
			status: "reserved" | "accepted" | "stopped" | "invalidated" | null;
			proposal: TaskProposal | null;
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
