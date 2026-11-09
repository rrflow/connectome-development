import type { RequestPayload, SuccessPayload } from "@rrflow/rrd-client";

/** The native boundary projects every contract integer as decimal text. */
type Decimal<T> = T extends number
	? string
	: T extends (infer V)[]
		? Decimal<V>[]
		: T extends object
			? { [K in keyof T]: Decimal<T[K]> }
			: T;
export type PlanSnapshot = Decimal<SuccessPayload<"attunement-read">>;
export type PlanPage = Decimal<SuccessPayload<"attunement-job-list">>;
export type Control =
	| { kind: "start" | "resume"; lease_ms: string }
	| { kind: "step" | "pause" | "recover_expired" | "replan" }
	| { kind: "cancel"; reason: string };
type PreparedCommand =
	| { kind: "start"; request: Decimal<RequestPayload<"attunement-start">> }
	| { kind: "step"; request: Decimal<RequestPayload<"attunement-step">> }
	| { kind: "pause"; request: Decimal<RequestPayload<"attunement-pause">> }
	| { kind: "resume"; request: Decimal<RequestPayload<"attunement-resume">> }
	| { kind: "recover_expired"; request: Decimal<RequestPayload<"attunement-recover-expired">> }
	| { kind: "cancel"; request: Decimal<RequestPayload<"attunement-cancel">> }
	| { kind: "replan"; request: Decimal<RequestPayload<"attunement-replan-accept">> };
export interface PlanRecovery {
	job_id: string;
	idempotency_key: string;
	replan: boolean;
}
export interface PreparedPlan extends PlanRecovery {
	kind: "prepared";
	handle: string;
	snapshot: PlanSnapshot;
	command: PreparedCommand;
}
export type AttunementCommand =
	| { action: "pending" }
	| { action: "list"; after_job_id: string | null }
	| { action: "read"; job_id: string }
	| {
			action: "prepare";
			job_id: string;
			expected_revision: string;
			plan_sha256: string;
			command: Control;
	  }
	| { action: "approve" | "discard"; handle: string }
	| ({ action: "receipt" } & PlanRecovery);
export type AttunementReply =
	| { kind: "pending"; prepared: PreparedPlan | null }
	| { kind: "page"; page: PlanPage }
	| { kind: "snapshot" | "applied"; snapshot: PlanSnapshot }
	| PreparedPlan
	| { kind: "receipt"; snapshot: PlanSnapshot | null }
	| { kind: "discarded" }
	| { kind: "uncertain" | "denied"; message: string };

export function readPlanRecovery(key: string): PlanRecovery | null {
	const raw = localStorage.getItem(key);
	if (!raw) return null;
	const value: unknown = JSON.parse(raw);
	if (
		!value ||
		typeof value !== "object" ||
		!("job_id" in value) ||
		!("idempotency_key" in value) ||
		!("replan" in value) ||
		typeof value.job_id !== "string" ||
		typeof value.idempotency_key !== "string" ||
		typeof value.replan !== "boolean"
	)
		throw new Error(
			"Stored project-plan recovery coordinates are invalid; preserve them for inspection",
		);
	return { job_id: value.job_id, idempotency_key: value.idempotency_key, replan: value.replan };
}
