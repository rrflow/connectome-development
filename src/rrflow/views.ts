import type { OperationId } from "@rrflow/rrd-client";
import type { InstanceState, ProjectInstance } from "~/types";

/**
 * The views of a project and what each one needs from its RRFlow instance
 * (sprint 009, step F4b, decisions 18 and 19).
 *
 * A view is available when its project's instance runs. Inside a ready
 * instance it needs every operation it calls to be in that instance's
 * catalogue, and every capability it shows to be declared and not
 * unavailable. A view Connectome has not built yet shows what the instance
 * serves for it, in the engine's words; nothing here makes a view available
 * by itself. Navigation reads its areas and views from this registry.
 */

export type AreaId = "overview" | "knowledge" | "activity" | "learning" | "services" | "api";

export interface AreaDefinition {
	id: AreaId;
	label: string;
}

/** The project's areas, in navigation order. */
export const AREAS: readonly AreaDefinition[] = [
	{ id: "overview", label: "Overview" },
	{ id: "knowledge", label: "Knowledge" },
	{ id: "activity", label: "Activity" },
	{ id: "learning", label: "Learning" },
	{ id: "services", label: "Services" },
	{ id: "api", label: "API reference" },
];

export type ViewId =
	| "overview"
	| "knowledge/models"
	| "knowledge/records"
	| "knowledge/vectors"
	| "knowledge/storage"
	| "knowledge/paths"
	| "activity"
	| "learning"
	| "services"
	| "api";

export interface ViewDefinition {
	id: ViewId;
	area: AreaId;
	title: string;
	/** Every operation the view calls. */
	operations: readonly OperationId[];
	/** The engine capabilities whose state the view depends on. */
	capabilities: readonly string[];
	/** Whether Connectome renders this view yet. */
	built: boolean;
}

export const VIEWS: readonly ViewDefinition[] = [
	{
		id: "overview",
		area: "overview",
		title: "Overview",
		operations: ["capabilities-read", "diagnostics-read", "vector-collection-list"],
		capabilities: [],
		built: true,
	},
	{
		id: "knowledge/models",
		area: "knowledge",
		title: "Data models",
		operations: ["data-schema-read", "query-execute"],
		capabilities: ["exact-rrflowql-query"],
		built: true,
	},
	{
		id: "knowledge/records",
		area: "knowledge",
		title: "Records & relations",
		operations: ["diagnostics-read", "query-execute"],
		capabilities: ["exact-rrflowql-query"],
		built: true,
	},
	{
		id: "knowledge/vectors",
		area: "knowledge",
		title: "Vectors",
		operations: [
			"vector-collection-list",
			"vector-point-scroll",
			"vector-point-retrieve",
			"vector-search",
		],
		capabilities: ["vector-search"],
		built: true,
	},
	{
		id: "knowledge/storage",
		area: "knowledge",
		title: "Storage engine",
		operations: ["diagnostics-read"],
		capabilities: [],
		built: true,
	},
	{
		id: "knowledge/paths",
		area: "knowledge",
		title: "Knowledge paths",
		operations: ["knowledge-tree-list", "knowledge-tree-replace"],
		capabilities: ["knowledge-tree-catalogue"],
		built: false,
	},
	{
		id: "activity",
		area: "activity",
		title: "Activity and evaluation",
		operations: [
			"changefeed-read",
			"changefeed-follow",
			"audit-read",
			"flight-list",
			"flight-read",
			"task-list",
			"task-read",
		],
		capabilities: ["changefeed-follow", "lifecycle-journal", "governed-reasoning-runner"],
		built: false,
	},
	{
		id: "learning",
		area: "learning",
		title: "RROFLOW learning",
		operations: [],
		capabilities: [],
		built: false,
	},
	{
		id: "services",
		area: "services",
		title: "Models, subscriptions and cloud",
		operations: [],
		capabilities: [],
		built: false,
	},
	{
		id: "api",
		area: "api",
		title: "API reference",
		operations: ["endpoint-catalogue"],
		capabilities: ["endpoint-catalogue"],
		built: true,
	},
];

export function view(id: ViewId): ViewDefinition {
	const found = VIEWS.find((candidate) => candidate.id === id);
	if (!found) throw new Error(`no view ${id}`);
	return found;
}

/** One engine capability as an instance declares it. */
export interface CapabilityState {
	name: string;
	status: "available" | "experimental" | "unavailable";
	limitation?: string;
}

/** What a ready instance offers: its catalogue's operations and its capabilities. */
export interface InstanceOffer {
	operations: ReadonlySet<string>;
	capabilities: readonly CapabilityState[];
}

export type ViewState =
	/** Everything the view needs is served; experimental capabilities are named. */
	| { kind: "ready"; experimental: CapabilityState[] }
	/** The project's instance is not ready, or not yet read. */
	| { kind: "instance"; state: InstanceState | "unknown"; detail: string }
	/** Connectome has not built this view; what the instance serves for it. */
	| {
			kind: "planned";
			served: OperationId[];
			unserved: OperationId[];
			capabilities: CapabilityState[];
	  }
	/** The instance does not serve some of the view's operations. */
	| { kind: "unserved"; operations: OperationId[] }
	/** A capability the view needs is unavailable or not declared. */
	| { kind: "unavailable"; capabilities: CapabilityState[] };

/**
 * A view's state: the instance's lifecycle first, then whether Connectome has
 * built the view, then the instance's catalogue, then its capabilities.
 */
export function viewState(
	definition: ViewDefinition,
	instance: ProjectInstance | undefined,
	offer: InstanceOffer | undefined,
): ViewState {
	if (instance?.state !== "ready") {
		return {
			kind: "instance",
			state: instance?.state ?? "stopped",
			detail: instance?.detail ?? "Not running.",
		};
	}
	if (!offer) {
		return {
			kind: "instance",
			state: "unknown",
			detail: "Reading what this instance serves.",
		};
	}
	const declared = definition.capabilities.map(
		(name): CapabilityState =>
			offer.capabilities.find((capability) => capability.name === name) ?? {
				name,
				status: "unavailable",
				limitation: "This instance does not declare it.",
			},
	);
	const served = definition.operations.filter((operation) => offer.operations.has(operation));
	const unserved = definition.operations.filter((operation) => !offer.operations.has(operation));
	if (!definition.built) {
		return { kind: "planned", served, unserved, capabilities: declared };
	}
	if (unserved.length > 0) {
		return { kind: "unserved", operations: unserved };
	}
	const unavailable = declared.filter((capability) => capability.status === "unavailable");
	if (unavailable.length > 0) {
		return { kind: "unavailable", capabilities: unavailable };
	}
	return {
		kind: "ready",
		experimental: declared.filter((capability) => capability.status === "experimental"),
	};
}
