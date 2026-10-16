import { invoke, isTauri } from "@tauri-apps/api/core";

/*
 * Authenticated RRD session views.
 *
 * RRFlow's Rust SDK (`rrd-client` + `rrd-contract`) owns every RRD wire type
 * and validates each response inside the Tauri process. These interfaces are
 * Connectome view models: the bounded projections `src-tauri/src/rrd/view.rs`
 * serializes for the Database, Vectors, and Storage lenses. The operator
 * credential and the session bearer never cross into the webview.
 */

export interface RrdReference {
	kind: string;
	id: string;
}

export interface RrdSessionView {
	session_id: string;
	issued_at_unix_ms: number;
	idle_expires_at_unix_ms: number;
	absolute_expires_at_unix_ms: number;
}

export interface RrdCapabilityView {
	name: string;
	contract_version: number;
	status: string;
	limitation: string | null;
}

export interface RrdInstalledEstateView {
	project_id: string;
	estate_id: string;
	instance_id: string;
}

export interface RrdServiceView {
	implementation: string;
	implementation_version: string;
	instance: string;
	deployment_form: string;
	storage_profile: string;
	endpoint_presentation: string;
	installed_estate: RrdInstalledEstateView | null;
	configuration_revision: number;
	configuration_sha256: string;
	capabilities: RrdCapabilityView[];
}

export interface RrdConnectionView {
	endpoint: string;
	instance: string;
	principal: string;
	connected_at_unix_ms: number;
	session: RrdSessionView;
	service: RrdServiceView;
}

export interface RrdTableView {
	name: string;
	model: string;
	mode: string;
}

export interface RrdModelView {
	id: string;
	kind: string;
	property_count: number;
	required_property_count: number;
	constraint_count: number;
}

export interface RrdNodeView {
	id: string;
	kind: string;
	key: string;
	label: string;
	valid_from_unix_ms: number;
	properties: Record<string, string>;
}

export interface RrdEdgeView {
	id: string;
	kind: string;
	from: string;
	to: string;
}

export interface RrdGraphView {
	valid_at_unix_ms: number;
	known_at_cursor: number;
	nodes: RrdNodeView[];
	edges: RrdEdgeView[];
}

export interface RrdSectionView {
	id: string;
	authority: string;
	coverage: string;
	row_count: number;
	known_at_cursor: number;
}

export interface RrdDatabaseView {
	observed_at_unix_ms: number;
	runtime_cursor: number;
	schema_revision: number | null;
	tables: RrdTableView[];
	models: RrdModelView[];
	graph: RrdGraphView;
	sections: RrdSectionView[];
}

export interface RrdQueryRowView {
	identity: string;
	values: Record<string, string>;
}

export interface RrdQueryView {
	canonical_query: string;
	known_at_cursor: number;
	schema_revision: number;
	columns: string[];
	rows: RrdQueryRowView[];
	returned_rows: number;
	truncated: boolean;
	keys_examined: number;
	output_bytes: number;
}

export interface RrdNamedVectorView {
	name: string;
	field: string;
	kind: string;
	dimensions: number;
	metric: string;
	memory_tier: string;
	embedding_model: string | null;
	embedding_model_digest: string | null;
}

export interface RrdCollectionView {
	collection_id: string;
	generation: number;
	updated_at_unix_ms: number;
	configuration_sha256: string;
	payload_indexes: number;
	vectors: RrdNamedVectorView[];
}

export interface RrdVectorCollectionsView {
	revision: number;
	collections: RrdCollectionView[];
}

export interface RrdPointView {
	reference: RrdReference;
	subject: RrdReference;
	source_cursor: number;
	value_kind: string;
	dimensions: number;
	norm: number;
	preview: number[];
	payload: Record<string, string>;
}

export interface RrdVectorPointsView {
	collection_id: string;
	vector_name: string;
	known_at_cursor: number;
	keys_examined: number;
	points: RrdPointView[];
	next_after: RrdReference | null;
	truncated: boolean;
}

export interface RrdHitView {
	reference: RrdReference;
	subject: RrdReference;
	score: number;
	source_cursor: number;
}

export interface RrdVectorSearchView {
	query: RrdReference;
	access_path: string;
	exact: boolean;
	known_at_cursor: number;
	keys_examined: number;
	canonical_candidates: number;
	selected_candidates: number;
	loaded_artifact_bytes: number;
	hits: RrdHitView[];
}

export interface RrdVectorArtifactView {
	kind: string;
	projection_id: string;
	generation: number;
	source_cursor: number;
	object_length: number;
	media_type: string;
	published_at_unix_ms: number;
}

export interface RrdQueryIndexView {
	index_id: string;
	kind: string;
	state: string;
	generation: number;
	artifact_rows: number | null;
	definition_query: string;
}

export type RrdMetricUnit = "count" | "bytes" | "ratio";

export interface RrdMetricView {
	id: string;
	label: string;
	unit: RrdMetricUnit;
	value: number;
	/** Ceiling for a fill gauge, such as a cache capacity or a flush trigger. */
	limit: number | null;
	/** Cumulative since the engine process opened its store. */
	cumulative: boolean;
}

export interface RrdMetricGroupView {
	id: string;
	label: string;
	metrics: RrdMetricView[];
	notes: string[];
}

/** The engine's process-local storage observation; not part of the read stamp. */
export interface RrdPhysicalStorageView {
	observed_at_unix_ms: number;
	profile: string;
	evidence_level: string;
	headline: RrdMetricView[];
	groups: RrdMetricGroupView[];
}

export interface RrdStorageView {
	observed_at_unix_ms: number;
	storage_profile: string;
	backend: string;
	runtime_cursor: number;
	claim_sequence: number;
	control_sequence: number;
	catalogue_revision: number;
	schema_revision: number | null;
	runtime_manifest_sha256: string;
	change_head_cursor: number;
	oldest_retained_cursor: number | null;
	retention_leases: number;
	retention_pins: number;
	audit_through_sequence: number;
	vector_artifacts: RrdVectorArtifactView[];
	query_indexes: RrdQueryIndexView[];
	physical: RrdPhysicalStorageView;
}

export interface RrdConnectRequest {
	/** Loopback HTTP origin of the RRD service. */
	endpoint: string;
	/** Instance identity confirmed by the public capability handshake. */
	instance: string;
	/** Installed operator credential file; read only by the native process. */
	credential_path: string;
}

export interface RrdVectorPointsRequest {
	collection_id: string;
	vector_name: string;
	after: RrdReference | null;
	limit: number;
}

export interface RrdVectorSearchRequest {
	collection_id: string;
	vector_name: string;
	example: RrdReference;
	top_k: number;
}

/** One authenticated RRD session held by Connectome's native process. */
export class RrdSessionClient {
	private requireNative() {
		if (!isTauri()) {
			throw new Error("Authenticated RRD sessions require the native Connectome client");
		}
	}

	async connect(request: RrdConnectRequest): Promise<RrdConnectionView> {
		this.requireNative();
		const connection = await invoke<RrdConnectionView>("rrd_connect", { request });
		if (
			connection.instance !== request.instance ||
			connection.service.instance !== request.instance
		) {
			throw new Error("RRD session changed the requested instance identity");
		}
		return connection;
	}

	/** The live native session, if one survives from an earlier visit. */
	async current(): Promise<RrdConnectionView | null> {
		this.requireNative();
		return invoke<RrdConnectionView | null>("rrd_session");
	}

	async capabilities(): Promise<RrdServiceView> {
		this.requireNative();
		return invoke<RrdServiceView>("rrd_capabilities");
	}

	async database(): Promise<RrdDatabaseView> {
		this.requireNative();
		return invoke<RrdDatabaseView>("rrd_database");
	}

	async storage(): Promise<RrdStorageView> {
		this.requireNative();
		return invoke<RrdStorageView>("rrd_storage");
	}

	async query(query: string): Promise<RrdQueryView> {
		this.requireNative();
		return invoke<RrdQueryView>("rrd_query", { request: { query } });
	}

	async vectorCollections(): Promise<RrdVectorCollectionsView> {
		this.requireNative();
		return invoke<RrdVectorCollectionsView>("rrd_vector_collections");
	}

	async vectorPoints(request: RrdVectorPointsRequest): Promise<RrdVectorPointsView> {
		this.requireNative();
		return invoke<RrdVectorPointsView>("rrd_vector_points", { request });
	}

	async vectorSearch(request: RrdVectorSearchRequest): Promise<RrdVectorSearchView> {
		this.requireNative();
		return invoke<RrdVectorSearchView>("rrd_vector_search", { request });
	}

	async disconnect(): Promise<void> {
		this.requireNative();
		await invoke<void>("rrd_disconnect");
	}
}
