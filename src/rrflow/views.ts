import type { OperationId } from "@rrflow/rrd-client";

/**
 * What each project view needs from the engine that serves it (sprint 009,
 * step F4b, decisions 18 and 19).
 *
 * The views themselves are route files: a view exists when its file exists, and
 * its area is its folder. This registry adds only what a route file cannot say,
 * the operations the view calls and the capabilities it shows, keyed by the
 * view's path under the project (`knowledge/vectors`). `check-view-registry`
 * holds every key to a real route, every operation to the pinned SDK and the
 * pinned engine's catalogue, and every capability to the pinned engine's
 * declared set. A view with no entry here is not gated.
 *
 * Nothing here makes a view available by itself: a view is ready only when the
 * engine serves every operation it calls and does not mark a capability it
 * shows unavailable.
 */
export interface ViewNeeds {
	/** Every operation the view calls. */
	operations: readonly OperationId[];
	/** The engine capabilities whose state the view depends on. */
	capabilities: readonly string[];
}

export const VIEW_NEEDS: Readonly<Record<string, ViewNeeds>> = {
	overview: {
		operations: ["capabilities-read", "diagnostics-read", "vector-collection-list"],
		capabilities: [],
	},
	"knowledge/models": {
		operations: ["data-schema-read", "query-execute"],
		capabilities: ["exact-rrflowql-query"],
	},
	"knowledge/records": {
		operations: ["diagnostics-read", "query-execute"],
		capabilities: ["exact-rrflowql-query"],
	},
	"knowledge/vectors": {
		operations: [
			"vector-collection-list",
			"vector-point-scroll",
			"vector-point-retrieve",
			"vector-search",
		],
		capabilities: ["vector-search"],
	},
	"knowledge/paths": {
		operations: ["knowledge-tree-list", "knowledge-tree-replace"],
		capabilities: ["knowledge-tree-catalogue"],
	},
	"system/storage": { operations: ["diagnostics-read"], capabilities: [] },
	"system/api": { operations: ["endpoint-catalogue"], capabilities: ["endpoint-catalogue"] },
	"activity/stream": {
		operations: ["changefeed-read", "changefeed-follow"],
		capabilities: ["changefeed-follow"],
	},
	"activity/audit": { operations: ["audit-read"], capabilities: [] },
	"workbench/flights": { operations: ["flight-list", "flight-read"], capabilities: [] },
	"reasoning/tasks": { operations: ["task-list", "task-read"], capabilities: [] },
};

/** One engine capability as an instance declares it. */
export interface CapabilityState {
	name: string;
	status: "available" | "experimental" | "unavailable";
	limitation?: string;
}

/** What a reachable instance offers: its catalogue's operations and its capabilities. */
export interface InstanceOffer {
	operations: ReadonlySet<string>;
	capabilities: readonly CapabilityState[];
}

export type ViewState =
	/** The view has no entry, or everything it needs is served. Experimental capabilities are named. */
	| { kind: "ready"; experimental: CapabilityState[] }
	/** The instance does not serve some of the view's operations. */
	| { kind: "unserved"; operations: OperationId[] }
	/** A capability the view needs is unavailable or not declared. */
	| { kind: "unavailable"; capabilities: CapabilityState[] };

/** A view's state against what its instance offers: the catalogue first, then the capabilities. */
export function viewState(path: string, offer: InstanceOffer): ViewState {
	const needs = VIEW_NEEDS[path];
	if (!needs) return { kind: "ready", experimental: [] };
	const unserved = needs.operations.filter((operation) => !offer.operations.has(operation));
	if (unserved.length > 0) return { kind: "unserved", operations: unserved };
	const declared = needs.capabilities.map(
		(name): CapabilityState =>
			offer.capabilities.find((capability) => capability.name === name) ?? {
				name,
				status: "unavailable",
				limitation: "This instance does not declare it.",
			},
	);
	const unavailable = declared.filter((capability) => capability.status === "unavailable");
	if (unavailable.length > 0) return { kind: "unavailable", capabilities: unavailable };
	return {
		kind: "ready",
		experimental: declared.filter((capability) => capability.status === "experimental"),
	};
}
