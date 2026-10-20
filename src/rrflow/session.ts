import { Channel, type InvokeArgs, invoke, isTauri } from "@tauri-apps/api/core";

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

/**
 * The session policy the engine granted. The native client renews the session
 * before the idle limit passes and opens a new one before the absolute limit,
 * timed on its own monotonic clock, so no expiry instant crosses the boundary.
 */
export interface RrdSessionView {
	idle_timeout_ms: number;
	absolute_timeout_ms: number;
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

export interface RrdSchemaView {
	known_at_cursor: number;
	read_manifest_sha256: string;
	schema_revision: number | null;
	truncated: boolean;
	tables: {
		name: string;
		model: string;
		mode: string;
		properties: Record<string, unknown>;
		additional_properties: boolean;
	}[];
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
	/** Index into `RrdGraphView.clusters`. */
	cluster: number;
}

/**
 * A group of records linked more densely to each other than to the rest of
 * the estate. Connectome computes clusters from the relations to color the
 * graph; they are not estate data.
 */
export interface RrdClusterView {
	id: number;
	size: number;
	/** The member with the most relations, which names the cluster. */
	anchor: string;
	label: string;
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
	/** Largest first. */
	clusters: RrdClusterView[];
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

export interface RrdMapPointView {
	reference: RrdReference;
	subject: RrdReference;
}

export interface RrdMapLinkView {
	/** Indexes into `RrdVectorMapView.points`; `to` is among `from`'s nearest. */
	from: number;
	to: number;
	/** 1 for the nearest neighbour. */
	rank: number;
	score: number;
}

/** Every drawn point with its nearest neighbours from the engine's exact search. */
export interface RrdVectorMapView {
	collection_id: string;
	vector_name: string;
	points: RrdMapPointView[];
	links: RrdMapLinkView[];
	/** Neighbours requested for each point. */
	neighbours: number;
	/** The collection holds more points than the map draws. */
	truncated: boolean;
	/** Points whose value kind cannot be searched by example. */
	unsearchable: number;
	searches: number;
	exact: boolean;
	keys_examined: number;
	known_at_cursor_min: number;
	known_at_cursor_max: number;
	elapsed_ms: number;
}

/** Progress of a similarity-map build, streamed while its searches run. */
export interface RrdVectorMapProgressView {
	/** Exact searches finished. */
	searched: number;
	/** Exact searches the map needs: one per searchable point. */
	total: number;
	/**
	 * The points the map draws, sent once with the first message, so a lens can
	 * resolve its records to points before the searches finish.
	 */
	points: RrdMapPointView[] | null;
	/** The collection holds more points than the map draws. */
	truncated: boolean;
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

export interface RrdVectorMapRequest {
	collection_id: string;
	vector_name: string;
}

export interface RrdVectorSearchRequest {
	collection_id: string;
	vector_name: string;
	example: RrdReference;
	top_k: number;
}

/**
 * A failed native RRD command. `retryable` is the engine's own classification:
 * it marks a transient storage conflict retryable, such as a diagnostic read
 * that requests landing meanwhile kept changing.
 */
export class RrdCommandError extends Error {
	readonly retryable: boolean;

	constructor(message: string, retryable: boolean) {
		super(message);
		this.name = "RrdCommandError";
		this.retryable = retryable;
	}
}

/** Whether a failure is the engine asking to be asked again later. */
export function isRetryable(error: unknown): boolean {
	return error instanceof RrdCommandError && error.retryable;
}

/** Invokes a native RRD command, turning its error into an `Error`. */
async function call<T>(command: string, args?: InvokeArgs): Promise<T> {
	try {
		return await invoke<T>(command, args);
	} catch (error) {
		if (typeof error === "object" && error !== null && "message" in error) {
			const retryable = "retryable" in error && error.retryable === true;
			throw new RrdCommandError(String(error.message), retryable);
		}
		throw error instanceof Error ? error : new Error(String(error));
	}
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
		const connection = await call<RrdConnectionView>("rrd_connect", { request });
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
		return call<RrdConnectionView | null>("rrd_session");
	}

	async capabilities(): Promise<RrdServiceView> {
		this.requireNative();
		return call<RrdServiceView>("rrd_capabilities");
	}

	async schema(): Promise<RrdSchemaView> {
		this.requireNative();
		return call<RrdSchemaView>("rrd_schema");
	}

	async database(): Promise<RrdDatabaseView> {
		this.requireNative();
		return call<RrdDatabaseView>("rrd_database");
	}

	async storage(): Promise<RrdStorageView> {
		this.requireNative();
		return call<RrdStorageView>("rrd_storage");
	}

	async query(query: string): Promise<RrdQueryView> {
		this.requireNative();
		return call<RrdQueryView>("rrd_query", { request: { query } });
	}

	async vectorCollections(): Promise<RrdVectorCollectionsView> {
		this.requireNative();
		return call<RrdVectorCollectionsView>("rrd_vector_collections");
	}

	async vectorPoints(request: RrdVectorPointsRequest): Promise<RrdVectorPointsView> {
		this.requireNative();
		return call<RrdVectorPointsView>("rrd_vector_points", { request });
	}

	async vectorSearch(request: RrdVectorSearchRequest): Promise<RrdVectorSearchView> {
		this.requireNative();
		return call<RrdVectorSearchView>("rrd_vector_search", { request });
	}

	/**
	 * Nearest neighbours of every drawn point; one exact engine search each.
	 * `onProgress` hears each finished search while the map builds.
	 */
	async vectorMap(
		request: RrdVectorMapRequest,
		onProgress?: (progress: RrdVectorMapProgressView) => void,
	): Promise<RrdVectorMapView> {
		this.requireNative();
		const progress = new Channel<RrdVectorMapProgressView>();
		if (onProgress) progress.onmessage = onProgress;
		return call<RrdVectorMapView>("rrd_vector_map", { request, onProgress: progress });
	}

	async disconnect(): Promise<void> {
		this.requireNative();
		await call<void>("rrd_disconnect");
	}
}
