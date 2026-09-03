export type EndpointSource = "direct" | "mesh";

export interface RuntimeEndpointResolution {
	source: EndpointSource;
	origin: string;
	provider?: string;
	devspace_id?: string;
	device_id?: string;
	attestation_ref?: string;
}

export type AttunementPhaseId =
	| "connect"
	| "inventory"
	| "parse"
	| "normalize"
	| "entity-link"
	| "lexical-index"
	| "embed"
	| "vector-index"
	| "graph"
	| "ground"
	| "verify";

export interface AttunementPhaseView {
	id: AttunementPhaseId;
	label: string;
	description: string;
	state: "implemented" | "contract-pending";
}

export const ATTUNEMENT_ESTIMATE_MINUTES = { minimum: 30, maximum: 45 } as const;

export const ATTUNEMENT_PHASES: readonly AttunementPhaseView[] = [
	{
		id: "connect",
		label: "Connect",
		description:
			"Resolve the endpoint and verify RRD transport, readiness, protocol, and identity.",
		state: "implemented",
	},
	{
		id: "inventory",
		label: "Inventory",
		description: "Discover project files and metadata without mutating engine state.",
		state: "contract-pending",
	},
	{
		id: "parse",
		label: "Parse",
		description: "Extract syntax and structure with language-aware parsers.",
		state: "contract-pending",
	},
	{
		id: "normalize",
		label: "Normalize",
		description:
			"Plan canonical records, claims, and relations for one engine transaction stream.",
		state: "contract-pending",
	},
	{
		id: "entity-link",
		label: "Entity link",
		description: "Resolve durable identities and temporal relationships before indexing.",
		state: "contract-pending",
	},
	{
		id: "lexical-index",
		label: "Lexical index",
		description: "Checkpoint persistent BM25 work against the canonical runtime cursor.",
		state: "contract-pending",
	},
	{
		id: "embed",
		label: "Embed",
		description: "Schedule permitted embedding work through engine-owned model contracts.",
		state: "contract-pending",
	},
	{
		id: "vector-index",
		label: "Vector index",
		description: "Build or update ANN candidates with authoritative exact reranking retained.",
		state: "contract-pending",
	},
	{
		id: "graph",
		label: "Graph",
		description: "Materialize typed relations into the same temporal snapshot boundary.",
		state: "contract-pending",
	},
	{
		id: "ground",
		label: "Ground",
		description: "Bind source evidence and stable warp points to canonical records.",
		state: "contract-pending",
	},
	{
		id: "verify",
		label: "Verify",
		description:
			"Run reopen, retrieval, graph, and evidence checks before declaring attunement ready.",
		state: "contract-pending",
	},
];

export const AUTOMATION_PRIMITIVES = [
	{
		name: "Trigger",
		contract: "A versioned condition over canonical engine events.",
	},
	{
		name: "Routine",
		contract: "A resumable sequence of authorized RrdEngine operations.",
	},
	{
		name: "Hook adapter",
		contract: "A host boundary that submits typed events; it never owns recall or lifecycle.",
	},
	{
		name: "Skill",
		contract:
			"A versioned instruction/resource reference resolved into engine-governed context.",
	},
] as const;
