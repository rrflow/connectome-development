import { knowledgeId } from "~/rrflow/knowledge";
import type { RrdKnowledgePathBindingView } from "~/rrflow/session";

export function errorText(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export type ExternalBinding = Extract<RrdKnowledgePathBindingView, { kind: "external" }>;

/** A fresh external-service binding: nothing chosen, bounded defaults. */
export function externalBinding(): ExternalBinding {
	return {
		kind: "external",
		provider_id: "",
		namespace: null,
		index: null,
		collection: null,
		endpoint: {
			id: knowledgeId("binding"),
			class: "vector_store",
			kind: "api",
			endpoint: { kind: "url", url: "" },
			service_id: "",
			manifest_sha256: null,
			credential: { provider: "", name: "" },
			placement: null,
			footprint: { memory_bytes: 1024 * 1024, gpu: { kind: "none" } },
			limits: { max_concurrency: 4, timeout_ms: 10_000, max_input_bytes: 1024 * 1024 },
		},
	};
}

/** Setup labels only; a provider here is a name for a saved reference, not a connector. */
export const providerNames = new Map([
	["postgres-pgvector", "PostgreSQL (pgvector)"],
	["hydradb", "HydraDB"],
	["mongodb-atlas", "MongoDB Atlas"],
	["pinecone-nexus", "Pinecone Nexus"],
]);
