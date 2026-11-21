import type { RequestPayload, SuccessPayload } from "@rrflow/rrd-client";
import type { Decimal } from "./attunement";

export type ProjectPolicy = Decimal<SuccessPayload<"project-configuration-read">>;
export type EffectivePolicy = Decimal<SuccessPayload<"configuration-effective-read">>;
export type PolicyPlan = Decimal<SuccessPayload<"project-configuration-preview">>;
export type Settings = Decimal<
	RequestPayload<"project-configuration-preview">["change"]["settings"]
>;
export type Setting = keyof Settings;
export type Admission = Decimal<SuccessPayload<"query-execute">["configuration"]>;
export interface PreparedPolicy {
	kind: "prepared";
	handle: string;
	plan: PolicyPlan;
	uncertain: boolean;
}
export type ConfigurationCommand =
	| { action: "read" | "pending" }
	| { action: "prepare"; expected_revision: string; settings: Settings }
	| { action: "approve" | "discard"; handle: string };
export type ConfigurationReply =
	| {
			kind: "snapshot";
			project: ProjectPolicy;
			effective: EffectivePolicy | null;
			effective_error: string | null;
	  }
	| { kind: "pending"; prepared: PreparedPolicy | null }
	| PreparedPolicy
	| { kind: "applied"; project: ProjectPolicy }
	| { kind: "discarded" }
	| { kind: "denied" | "uncertain"; message: string };

/** Labels explain contract fields; bounds and decisions always come from the engine. */
export const settingLabels = {
	query_storage_keys: ["Storage examined per query", "keys"],
	query_rows: ["Rows returned per query", "rows"],
	query_output_bytes: ["Query response size", "bytes"],
	query_batch_rows: ["Rows per query batch", "rows"],
	query_memory_bytes: ["Query memory", "bytes"],
	query_spill_bytes: ["Query temporary disk space", "bytes"],
	query_elapsed_ms: ["Query time", "milliseconds"],
	recall_graph_depth: ["Relationship depth for recall", "hops"],
	recall_items: ["Items recalled", "items"],
	recall_output_bytes: ["Recalled context size", "bytes"],
	recall_storage_keys: ["Storage examined for recall", "keys"],
} satisfies Record<Setting, [string, string]>;
export const settingKeys = Object.keys(settingLabels) as Setting[];

export function currentSettings(project: ProjectPolicy): Settings {
	return project.head?.change.settings ?? project.installed_settings;
}

export function updateRule(
	settings: Settings,
	key: Setting,
	field: "minimum" | "maximum" | "preference",
	value: string,
): Settings {
	if (value && !/^\d+$/.test(value))
		throw new Error("Use a whole, non-negative number, without separators.");
	const rule = {
		minimum: null,
		maximum: null,
		preference: null,
		...settings[key],
		[field]: value || null,
	};
	const next = { ...settings };
	if (Object.values(rule).every((v) => v === null)) delete next[key];
	else next[key] = rule;
	return next;
}
