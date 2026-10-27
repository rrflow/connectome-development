//! Connectome view models projected from validated RRD responses.
//!
//! `rrd-contract` owns the wire schema. These structs carry only what the
//! Database, Vectors, and Storage lenses render, so the webview never decodes a
//! wire type and never receives a credential, token, or raw vector payload
//! larger than its preview.

use super::cluster;
use rrd_contract::{
    DataReference, DataVectorValue, DiagnosticRrflowKvSnapshot, DiagnosticRuntimeReference,
    DiagnosticSnapshot, DiagnosticStorageAdmission, DiagnosticStorageSnapshot, QueryResult,
    QueryValue, ServiceCapabilities, VectorCollectionCatalogueSnapshot, VectorPointPage,
    VectorPointSnapshot, VectorSearchResult,
};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

/// Leading components shown for a vector; the full value stays native.
const VECTOR_PREVIEW_COMPONENTS: usize = 8;
/// Longest property text rendered before truncation.
const MAX_DISPLAY_TEXT: usize = 2048;

/// The session policy the engine granted. Connectome renews the session before
/// the idle limit passes and opens a new one before the absolute limit, so the
/// webview shows the policy, never expiry instants read from another clock.
#[derive(Debug, Clone, Serialize)]
pub struct SessionView {
    pub idle_timeout_ms: u64,
    pub absolute_timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ServiceView {
    pub implementation: String,
    pub implementation_version: String,
    pub instance: String,
    pub deployment_form: String,
    pub storage_profile: String,
    pub endpoint_presentation: String,
    pub installed_estate: Option<InstalledEstateView>,
    pub configuration_revision: u64,
    pub configuration_sha256: String,
    pub capabilities: Vec<CapabilityView>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstalledEstateView {
    pub project_id: String,
    pub estate_id: String,
    pub instance_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CapabilityView {
    pub name: String,
    pub contract_version: u16,
    pub status: String,
    pub limitation: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionView {
    pub endpoint: String,
    pub instance: String,
    pub principal: String,
    pub connected_at_unix_ms: u64,
    pub session: SessionView,
    pub service: ServiceView,
}

#[derive(Debug, Serialize)]
pub struct DatabaseView {
    pub observed_at_unix_ms: u64,
    pub runtime_cursor: u64,
    pub schema_revision: Option<u64>,
    pub tables: Vec<TableView>,
    pub models: Vec<ModelView>,
    pub graph: GraphView,
    pub sections: Vec<SectionView>,
}

#[derive(Debug, Serialize)]
pub struct TableView {
    pub name: String,
    pub model: String,
    pub mode: String,
}

#[derive(Debug, Serialize)]
pub struct ModelView {
    pub id: String,
    pub kind: String,
    pub property_count: u64,
    pub required_property_count: u64,
    pub constraint_count: u64,
}

#[derive(Debug, Serialize)]
pub struct GraphView {
    pub valid_at_unix_ms: u64,
    pub known_at_cursor: u64,
    pub nodes: Vec<NodeView>,
    pub edges: Vec<EdgeView>,
    /// Connectome-computed clusters, largest first; not estate data.
    pub clusters: Vec<ClusterView>,
}

#[derive(Debug, Serialize)]
pub struct NodeView {
    pub id: String,
    pub kind: String,
    pub key: String,
    pub label: String,
    pub valid_from_unix_ms: u64,
    pub properties: BTreeMap<String, String>,
    /// Index into `GraphView::clusters`.
    pub cluster: usize,
}

/// A group of records linked more densely to each other than to the rest.
#[derive(Debug, Serialize)]
pub struct ClusterView {
    pub id: usize,
    pub size: usize,
    /// The member with the most relations, which names the cluster.
    pub anchor: String,
    pub label: String,
}

#[derive(Debug, Serialize)]
pub struct EdgeView {
    pub id: String,
    pub kind: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Serialize)]
pub struct SectionView {
    pub id: String,
    pub authority: String,
    pub coverage: String,
    pub row_count: u64,
    pub known_at_cursor: u64,
}

#[derive(Debug, Serialize)]
pub struct QueryView {
    pub canonical_query: String,
    pub known_at_cursor: u64,
    pub schema_revision: u64,
    pub columns: Vec<String>,
    pub rows: Vec<RowView>,
    pub returned_rows: u64,
    pub truncated: bool,
    pub keys_examined: u64,
    pub output_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct RowView {
    pub identity: String,
    pub values: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
pub struct VectorCollectionsView {
    pub revision: u64,
    pub collections: Vec<CollectionView>,
}

#[derive(Debug, Serialize)]
pub struct CollectionView {
    pub collection_id: String,
    pub generation: u64,
    pub updated_at_unix_ms: u64,
    pub configuration_sha256: String,
    pub payload_indexes: usize,
    pub vectors: Vec<NamedVectorView>,
}

#[derive(Debug, Serialize)]
pub struct NamedVectorView {
    pub name: String,
    pub field: String,
    pub kind: String,
    pub dimensions: u32,
    pub metric: String,
    pub memory_tier: String,
    pub embedding_model: Option<String>,
    pub embedding_model_digest: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VectorPointsView {
    pub collection_id: String,
    pub vector_name: String,
    pub known_at_cursor: u64,
    pub keys_examined: u64,
    pub points: Vec<PointView>,
    pub next_after: Option<ReferenceView>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReferenceView {
    pub kind: String,
    pub id: String,
}

#[derive(Debug, Serialize)]
pub struct PointView {
    pub reference: ReferenceView,
    pub subject: ReferenceView,
    pub source_cursor: u64,
    pub value_kind: String,
    pub dimensions: usize,
    pub norm: f64,
    pub preview: Vec<f32>,
    pub payload: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
pub struct VectorSearchView {
    pub query: ReferenceView,
    pub access_path: String,
    pub exact: bool,
    pub known_at_cursor: u64,
    pub keys_examined: u64,
    pub canonical_candidates: u64,
    pub selected_candidates: u64,
    pub loaded_artifact_bytes: u64,
    pub hits: Vec<HitView>,
}

#[derive(Debug, Serialize)]
pub struct HitView {
    pub reference: ReferenceView,
    pub subject: ReferenceView,
    pub score: f64,
    pub source_cursor: u64,
}

/// The similarity map: stored points plus each point's nearest neighbours as
/// returned by the engine's exact search. Vector values stay native.
#[derive(Debug, Serialize)]
pub struct VectorMapView {
    pub collection_id: String,
    pub vector_name: String,
    /// Points in reference order, at most the map bound.
    pub points: Vec<MapPointView>,
    /// `to` is one of `from`'s nearest neighbours; both index `points`.
    pub links: Vec<MapLinkView>,
    /// Neighbours requested for each point.
    pub neighbours: u64,
    /// The collection holds more points than the map draws.
    pub truncated: bool,
    /// Points whose value kind cannot be searched by example.
    pub unsearchable: usize,
    pub searches: u64,
    pub exact: bool,
    pub keys_examined: u64,
    pub known_at_cursor_min: u64,
    pub known_at_cursor_max: u64,
    pub elapsed_ms: u64,
}

/// Progress of a similarity-map build, streamed while its searches run.
#[derive(Debug, Serialize)]
pub struct VectorMapProgressView {
    /// Exact searches finished.
    pub searched: u64,
    /// Exact searches the map needs: one per searchable point.
    pub total: u64,
    /// The points the map draws, sent once with the first message, so a lens
    /// can resolve its records to points before the searches finish.
    pub points: Option<Vec<MapPointView>>,
    /// The collection holds more points than the map draws.
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct MapPointView {
    pub reference: ReferenceView,
    pub subject: ReferenceView,
}

#[derive(Debug, Serialize)]
pub struct MapLinkView {
    pub from: usize,
    pub to: usize,
    /// 1 for the nearest neighbour.
    pub rank: usize,
    pub score: f64,
}

#[derive(Debug, Serialize)]
pub struct StorageView {
    pub observed_at_unix_ms: u64,
    pub storage_profile: String,
    pub backend: String,
    pub runtime_cursor: u64,
    pub claim_sequence: u64,
    pub control_sequence: u64,
    pub catalogue_revision: u64,
    pub schema_revision: Option<u64>,
    pub runtime_manifest_sha256: String,
    pub change_head_cursor: u64,
    pub oldest_retained_cursor: Option<u64>,
    pub retention_leases: usize,
    pub retention_pins: usize,
    pub vector_artifacts: Vec<VectorArtifactView>,
    pub query_indexes: Vec<QueryIndexView>,
    pub physical: PhysicalStorageView,
}

/// How a physical metric renders. The renderer formats by unit and never
/// interprets what a metric means.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MetricUnit {
    Count,
    Bytes,
    Ratio,
}

#[derive(Debug, Serialize)]
pub struct MetricView {
    pub id: &'static str,
    pub label: &'static str,
    pub unit: MetricUnit,
    pub value: f64,
    /// Ceiling for a fill gauge: a cache capacity or a flush/compaction trigger.
    pub limit: Option<f64>,
    /// Cumulative since the engine process opened its store.
    pub cumulative: bool,
}

#[derive(Debug, Serialize)]
pub struct MetricGroupView {
    pub id: &'static str,
    pub label: &'static str,
    pub metrics: Vec<MetricView>,
    pub notes: Vec<String>,
}

/// The engine's process-local storage observation (`observation` authority).
#[derive(Debug, Serialize)]
pub struct PhysicalStorageView {
    pub observed_at_unix_ms: u64,
    pub profile: String,
    pub evidence_level: String,
    pub headline: Vec<MetricView>,
    pub groups: Vec<MetricGroupView>,
}

#[derive(Debug, Serialize)]
pub struct VectorArtifactView {
    pub kind: String,
    pub projection_id: String,
    pub generation: u64,
    pub source_cursor: u64,
    pub object_length: u64,
    pub media_type: String,
    pub published_at_unix_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct QueryIndexView {
    pub index_id: String,
    pub kind: String,
    pub state: String,
    pub generation: u64,
    pub artifact_rows: Option<u64>,
    pub definition_query: String,
}

/// The snake_case wire name of a contract enum, which is how it renders.
fn label<T: Serialize>(value: &T) -> String {
    match serde_json::to_value(value) {
        Ok(serde_json::Value::String(name)) => name,
        Ok(other) => other.to_string(),
        Err(_) => "unknown".into(),
    }
}

fn bounded(mut text: String) -> String {
    if text.len() > MAX_DISPLAY_TEXT {
        let mut end = MAX_DISPLAY_TEXT;
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        text.truncate(end);
        text.push('…');
    }
    text
}

pub fn display_value(value: &QueryValue) -> String {
    bounded(plain_value(value))
}

/// Renders a value as its content: a traversal path reads
/// `[document:a, document:b]`, not the tagged wire encoding.
fn plain_value(value: &QueryValue) -> String {
    match value {
        QueryValue::Null => "null".into(),
        QueryValue::Bool(value) => value.to_string(),
        QueryValue::Integer(value) => value.to_string(),
        QueryValue::Unsigned(value) => value.to_string(),
        QueryValue::Decimal(value) | QueryValue::String(value) | QueryValue::Digest(value) => {
            value.clone()
        }
        QueryValue::List(items) => format!(
            "[{}]",
            items.iter().map(plain_value).collect::<Vec<_>>().join(", ")
        ),
        QueryValue::Map(entries) => format!(
            "{{{}}}",
            entries
                .iter()
                .map(|(key, item)| format!("{key}: {}", plain_value(item)))
                .collect::<Vec<_>>()
                .join(", ")
        ),
    }
}

fn display_properties(properties: &BTreeMap<String, QueryValue>) -> BTreeMap<String, String> {
    properties
        .iter()
        .map(|(name, value)| (name.clone(), display_value(value)))
        .collect()
}

fn runtime_reference(reference: &DiagnosticRuntimeReference) -> String {
    format!("{}:{}", reference.kind, reference.id)
}

pub fn reference(reference: &DataReference) -> ReferenceView {
    ReferenceView {
        kind: reference.kind.as_str().into(),
        id: reference.id.as_str().into(),
    }
}

pub fn service(capabilities: &ServiceCapabilities) -> ServiceView {
    ServiceView {
        implementation: capabilities.implementation.as_str().into(),
        implementation_version: capabilities.implementation_version.clone(),
        instance: capabilities.instance.id.as_str().into(),
        deployment_form: label(&capabilities.deployment.deployment_form),
        storage_profile: label(&capabilities.deployment.storage_profile),
        endpoint_presentation: label(&capabilities.deployment.endpoint_presentation),
        installed_estate: capabilities.installed_estate.as_ref().map(|estate| {
            InstalledEstateView {
                project_id: estate.project_id.as_str().into(),
                estate_id: estate.estate_id.as_str().into(),
                instance_id: estate.instance_id.as_str().into(),
            }
        }),
        configuration_revision: capabilities.configuration.revision,
        configuration_sha256: capabilities.configuration.configuration_sha256.clone(),
        capabilities: capabilities
            .capabilities
            .iter()
            .map(|capability| CapabilityView {
                name: capability.name.as_str().into(),
                contract_version: capability.contract_version,
                status: label(&capability.status),
                limitation: capability.limitation.clone(),
            })
            .collect(),
    }
}

/// Assigns each node its cluster and names every cluster after its member with
/// the most relations (ties go to the earlier record).
fn cluster_views(nodes: &mut [NodeView], links: &[(usize, usize)]) -> Vec<ClusterView> {
    let membership = cluster::clusters(nodes.len(), links);
    let mut degree = vec![0usize; nodes.len()];
    for &(from, to) in links {
        degree[from] += 1;
        degree[to] += 1;
    }
    let count = membership.iter().max().map_or(0, |last| last + 1);
    let mut sizes = vec![0usize; count];
    let mut anchors: Vec<Option<usize>> = vec![None; count];
    for (position, &cluster) in membership.iter().enumerate() {
        sizes[cluster] += 1;
        let anchor = &mut anchors[cluster];
        if anchor.is_none_or(|current| degree[position] > degree[current]) {
            *anchor = Some(position);
        }
    }
    for (node, &cluster) in nodes.iter_mut().zip(&membership) {
        node.cluster = cluster;
    }
    anchors
        .into_iter()
        .zip(sizes)
        .enumerate()
        .filter_map(|(id, (anchor, size))| {
            let anchor = &nodes[anchor?];
            Some(ClusterView {
                id,
                size,
                anchor: anchor.id.clone(),
                label: anchor.label.clone(),
            })
        })
        .collect()
}

pub fn database(snapshot: &DiagnosticSnapshot) -> DatabaseView {
    let tables = snapshot
        .schema
        .as_ref()
        .map(|schema| {
            schema
                .tables
                .iter()
                .map(|(name, table)| TableView {
                    name: name.as_str().into(),
                    model: label(&table.model),
                    mode: label(&table.mode),
                })
                .collect()
        })
        .unwrap_or_default();
    let mut nodes: Vec<NodeView> = snapshot
        .graph
        .records
        .iter()
        .map(|record| {
            let properties = display_properties(&record.properties);
            let label = properties
                .get("title")
                .or_else(|| properties.get("name"))
                .cloned()
                .unwrap_or_else(|| record.reference.id.clone());
            NodeView {
                id: runtime_reference(&record.reference),
                kind: record.reference.kind.clone(),
                key: record.reference.id.clone(),
                label,
                valid_from_unix_ms: record.valid_from_unix_ms,
                properties,
                cluster: 0,
            }
        })
        .collect();
    let index: BTreeMap<&str, usize> = nodes
        .iter()
        .enumerate()
        .map(|(position, node)| (node.id.as_str(), position))
        .collect();
    let edges: Vec<EdgeView> = snapshot
        .graph
        .relations
        .iter()
        .map(|relation| EdgeView {
            id: runtime_reference(&relation.reference),
            kind: relation.reference.kind.clone(),
            from: runtime_reference(&relation.from),
            to: runtime_reference(&relation.to),
        })
        // A relation whose endpoint is outside the bounded record set is not
        // drawn as a dangling edge; the coverage section reports the bound.
        .filter(|edge| {
            index.contains_key(edge.from.as_str()) && index.contains_key(edge.to.as_str())
        })
        .collect();
    let links: Vec<(usize, usize)> = edges
        .iter()
        .map(|edge| (index[edge.from.as_str()], index[edge.to.as_str()]))
        .collect();
    let clusters = cluster_views(&mut nodes, &links);
    DatabaseView {
        observed_at_unix_ms: snapshot.observed_at_unix_ms,
        runtime_cursor: snapshot.read.runtime_cursor,
        schema_revision: snapshot.read.schema_revision,
        tables,
        models: snapshot
            .models
            .models
            .iter()
            .map(|model| ModelView {
                id: model.id.as_str().into(),
                kind: label(&model.kind),
                property_count: model.property_count,
                required_property_count: model.required_property_count,
                constraint_count: model.constraint_count,
            })
            .collect(),
        graph: GraphView {
            valid_at_unix_ms: snapshot.graph.valid_at_unix_ms,
            known_at_cursor: snapshot.graph.known_at_cursor,
            nodes,
            edges,
            clusters,
        },
        sections: snapshot
            .sections
            .iter()
            .map(|section| SectionView {
                id: section.id.as_str().into(),
                authority: label(&section.authority),
                coverage: label(&section.coverage),
                row_count: section.row_count,
                known_at_cursor: section.known_at_cursor,
            })
            .collect(),
    }
}

pub fn query(result: &QueryResult) -> QueryView {
    let mut columns = BTreeSet::new();
    let rows = result
        .rows
        .iter()
        .map(|row| {
            columns.extend(row.values.keys().cloned());
            RowView {
                identity: row.identity.clone(),
                values: display_properties(&row.values),
            }
        })
        .collect();
    QueryView {
        canonical_query: result.canonical_query.clone(),
        known_at_cursor: result.known_at_cursor,
        schema_revision: result.schema_revision,
        columns: columns.into_iter().collect(),
        rows,
        returned_rows: result.execution.returned_rows,
        truncated: result.execution.truncated,
        keys_examined: result.execution.read_evidence.keys_examined,
        output_bytes: result.execution.output_bytes,
    }
}

pub fn collections(catalogue: &VectorCollectionCatalogueSnapshot) -> VectorCollectionsView {
    VectorCollectionsView {
        revision: catalogue.revision,
        collections: catalogue
            .collections
            .iter()
            .map(|collection| CollectionView {
                collection_id: collection.collection_id.as_str().into(),
                generation: collection.generation,
                updated_at_unix_ms: collection.updated_at_unix_ms,
                configuration_sha256: collection.configuration_sha256.clone(),
                payload_indexes: collection.payload_indexes.len(),
                vectors: collection
                    .vectors
                    .iter()
                    .map(|vector| NamedVectorView {
                        name: vector.name.as_str().into(),
                        field: vector.field.as_str().into(),
                        kind: label(&vector.kind),
                        dimensions: vector.dimensions,
                        metric: label(&vector.metric),
                        memory_tier: label(&vector.memory_tier),
                        embedding_model: vector
                            .embedding_model
                            .as_ref()
                            .map(|model| model.name.clone()),
                        embedding_model_digest: vector
                            .embedding_model
                            .as_ref()
                            .map(|model| model.digest.clone()),
                    })
                    .collect(),
            })
            .collect(),
    }
}

fn point(point: &VectorPointSnapshot) -> PointView {
    let (value_kind, components): (&str, Vec<f32>) = match &point.value {
        DataVectorValue::Dense { values } => ("dense", values.clone()),
        DataVectorValue::Sparse { values, .. } => ("sparse", values.clone()),
        DataVectorValue::MultiDense { vectors, .. } => {
            ("multi_dense", vectors.iter().flatten().copied().collect())
        }
    };
    let norm = components
        .iter()
        .map(|component| f64::from(*component) * f64::from(*component))
        .sum::<f64>()
        .sqrt();
    PointView {
        reference: reference(&point.reference),
        subject: reference(&point.subject),
        source_cursor: point.source_cursor,
        value_kind: value_kind.into(),
        dimensions: components.len(),
        norm,
        preview: components
            .into_iter()
            .take(VECTOR_PREVIEW_COMPONENTS)
            .collect(),
        payload: display_properties(&point.payload),
    }
}

pub fn points(page: &VectorPointPage) -> VectorPointsView {
    VectorPointsView {
        collection_id: page.collection_id.as_str().into(),
        vector_name: page.vector_name.as_str().into(),
        known_at_cursor: page.known_at_cursor,
        keys_examined: page.read_evidence.keys_examined,
        points: page.points.iter().map(point).collect(),
        next_after: page.next_after.as_ref().map(reference),
        truncated: page.truncated,
    }
}

pub fn search(query: &DataReference, result: &VectorSearchResult) -> VectorSearchView {
    VectorSearchView {
        query: reference(query),
        access_path: result.access_path.as_str().into(),
        exact: result.exact,
        known_at_cursor: result.known_at_cursor,
        keys_examined: result.read_evidence.keys_examined,
        canonical_candidates: result.resources.canonical_candidates,
        selected_candidates: result.resources.selected_candidates,
        loaded_artifact_bytes: result.resources.loaded_artifact_bytes,
        hits: result
            .hits
            .iter()
            .map(|hit| HitView {
                reference: reference(&hit.reference),
                subject: reference(&hit.subject),
                score: hit.score,
                source_cursor: hit.source_cursor,
            })
            .collect(),
    }
}

pub fn storage(snapshot: &DiagnosticSnapshot, storage_profile: &str) -> StorageView {
    StorageView {
        observed_at_unix_ms: snapshot.observed_at_unix_ms,
        storage_profile: storage_profile.into(),
        backend: snapshot.readiness.backend.as_str().into(),
        runtime_cursor: snapshot.read.runtime_cursor,
        claim_sequence: snapshot.read.claim_sequence,
        control_sequence: snapshot.read.control_sequence,
        catalogue_revision: snapshot.read.catalogue_revision,
        schema_revision: snapshot.read.schema_revision,
        runtime_manifest_sha256: snapshot.read.runtime_manifest_sha256.clone(),
        change_head_cursor: snapshot.changes.head_cursor,
        oldest_retained_cursor: snapshot.retention.oldest_retained_cursor,
        retention_leases: snapshot.retention.leases.len(),
        retention_pins: snapshot.retention.pins.len(),
        vector_artifacts: snapshot
            .vector_artifacts
            .artifacts
            .iter()
            .map(|artifact| VectorArtifactView {
                kind: label(&artifact.kind),
                projection_id: artifact.projection_id.clone(),
                generation: artifact.generation,
                source_cursor: artifact.source_cursor,
                object_length: artifact.object_length,
                media_type: artifact.media_type.clone(),
                published_at_unix_ms: artifact.published_at_unix_ms,
            })
            .collect(),
        query_indexes: snapshot
            .query_indexes
            .indexes
            .iter()
            .map(|index| QueryIndexView {
                index_id: index.index_id.as_str().into(),
                kind: label(&index.kind),
                state: label(&index.state),
                generation: index.generation,
                artifact_rows: index.artifact_rows,
                definition_query: index.definition_query.clone(),
            })
            .collect(),
        physical: physical(&snapshot.storage),
    }
}

fn gauge(id: &'static str, label: &'static str, unit: MetricUnit, value: u64) -> MetricView {
    MetricView {
        id,
        label,
        unit,
        value: value as f64,
        limit: None,
        cumulative: false,
    }
}

fn filled(
    id: &'static str,
    label: &'static str,
    unit: MetricUnit,
    value: u64,
    limit: u64,
) -> MetricView {
    MetricView {
        limit: Some(limit as f64),
        ..gauge(id, label, unit, value)
    }
}

fn cumulative(id: &'static str, label: &'static str, unit: MetricUnit, value: u64) -> MetricView {
    MetricView {
        cumulative: true,
        ..gauge(id, label, unit, value)
    }
}

fn ratio(id: &'static str, label: &'static str, part: u64, whole: u64) -> Option<MetricView> {
    (whole > 0).then(|| MetricView {
        id,
        label,
        unit: MetricUnit::Ratio,
        value: part as f64 / whole as f64,
        limit: Some(1.0),
        cumulative: true,
    })
}

/// `524288` -> `524,288`.
fn grouped(value: u64) -> String {
    let digits = value.to_string();
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            out.push(',');
        }
        out.push(digit);
    }
    out
}

/// Exact binary units when the value divides evenly, otherwise bytes.
fn binary_size(bytes: u64) -> String {
    const UNITS: [(u64, &str); 3] = [(1 << 30, "GiB"), (1 << 20, "MiB"), (1 << 10, "KiB")];
    UNITS
        .iter()
        .find(|(size, _)| bytes >= *size && bytes.is_multiple_of(*size))
        .map(|(size, unit)| format!("{} {unit}", bytes / size))
        .unwrap_or_else(|| format!("{} bytes", grouped(bytes)))
}

fn physical(storage: &DiagnosticStorageSnapshot) -> PhysicalStorageView {
    let (headline, mut groups) = storage
        .rrflow_kv
        .as_ref()
        .map(rrflow_kv_metrics)
        .unwrap_or_default();
    groups.extend(storage.admission.as_ref().map(admission_metrics));
    PhysicalStorageView {
        observed_at_unix_ms: storage.observed_at_unix_ms,
        profile: label(&storage.profile),
        evidence_level: label(&storage.evidence_level),
        headline,
        groups,
    }
}

/// The engine's storage admission state: what it has admitted, pinned and
/// retained, and what is waiting.
fn admission_metrics(admission: &DiagnosticStorageAdmission) -> MetricGroupView {
    use MetricUnit::{Bytes, Count};
    let mut notes = vec![
        "Retained mutable and projected bytes are logical owner charges, not allocator or process memory.".to_owned(),
        "Retained source pages count owned page allocations and exclude borrowed mmap residency.".to_owned(),
        "Outstanding requests include the transaction being served and the admitted waiters.".to_owned(),
    ];
    if admission.active {
        notes.push("A transaction holds the serialization permit now.".to_owned());
    }
    if admission.fenced {
        notes.push(
            "Fenced: a transaction failed while holding the permit, so new transactions are refused until the engine restarts.".to_owned(),
        );
    }
    MetricGroupView {
        id: "admission",
        label: "Admission",
        metrics: vec![
            filled(
                "checkpoint_entries",
                "Checkpoint entries",
                Count,
                admission.checkpoint_entries,
                admission.checkpoint_limit,
            ),
            gauge(
                "native_transactions",
                "Native transactions",
                Count,
                admission.native_transactions,
            ),
            gauge(
                "native_transaction_bytes",
                "Native transaction bytes",
                Bytes,
                admission.native_transaction_bytes,
            ),
            gauge(
                "active_read_views",
                "Active read views",
                Count,
                admission.active_read_views,
            ),
            gauge(
                "pinned_read_bytes",
                "Pinned read bytes",
                Bytes,
                admission.pinned_read_bytes,
            ),
            gauge(
                "retained_mutable_bytes",
                "Retained mutable",
                Bytes,
                admission.retained_mutable_bytes,
            ),
            gauge(
                "retained_projected_bytes",
                "Retained projected",
                Bytes,
                admission.retained_projected_bytes,
            ),
            gauge(
                "retained_source_bytes",
                "Retained source pages",
                Bytes,
                admission.retained_source_bytes,
            ),
            gauge(
                "peak_source_bytes",
                "Peak source pages",
                Bytes,
                admission.peak_source_bytes,
            ),
            cumulative(
                "denied_source_allocations",
                "Denied source allocations",
                Count,
                admission.denied_source_allocations,
            ),
            gauge(
                "outstanding_requests",
                "Outstanding requests",
                Count,
                admission.outstanding_requests,
            ),
            gauge(
                "outstanding_logical_bytes",
                "Outstanding logical bytes",
                Bytes,
                admission.outstanding_logical_bytes,
            ),
            gauge(
                "queued_requests",
                "Queued requests",
                Count,
                admission.queued_requests,
            ),
        ],
        notes,
    }
}

fn rrflow_kv_metrics(kv: &DiagnosticRrflowKvSnapshot) -> (Vec<MetricView>, Vec<MetricGroupView>) {
    use MetricUnit::{Bytes, Count};
    let cache = &kv.page_cache;
    let lookups = cache.hits.saturating_add(cache.misses);
    let mut headline = Vec::new();
    headline.extend(ratio(
        "page_cache_hit_ratio",
        "Page cache hit ratio",
        cache.hits,
        lookups,
    ));
    headline.extend([
        filled(
            "page_cache_resident",
            "Page cache resident",
            Bytes,
            cache.resident_bytes,
            cache.capacity_bytes,
        ),
        filled(
            "memtable_versions",
            "Memtable versions",
            Count,
            kv.memtable.versions,
            kv.memtable.max_versions,
        ),
        filled(
            "wal_payload",
            "Write-ahead log",
            Bytes,
            kv.write_ahead_log.payload_bytes,
            kv.write_ahead_log.payload_max_bytes,
        ),
        filled(
            "l0_segments",
            "L0 segments",
            Count,
            kv.segment_set.l0_segments,
            kv.segment_set.l0_compaction_trigger,
        ),
        gauge(
            "compaction_debt",
            "Compaction debt (segments)",
            Count,
            kv.segment_set.compaction_debt_segments,
        ),
    ]);

    let mut page_cache = vec![
        gauge("capacity", "Capacity", Bytes, cache.capacity_bytes),
        filled(
            "resident",
            "Resident",
            Bytes,
            cache.resident_bytes,
            cache.capacity_bytes,
        ),
        gauge("entries", "Entries", Count, cache.entries),
        cumulative("hits", "Hits", Count, cache.hits),
        cumulative("misses", "Misses", Count, cache.misses),
        cumulative("evictions", "Evictions", Count, cache.evictions),
        cumulative("page_loads", "Page loads", Count, cache.page_loads),
        cumulative("bytes_read", "Bytes read", Bytes, cache.bytes_read),
        cumulative("bytes_decoded", "Bytes decoded", Bytes, cache.bytes_decoded),
        cumulative(
            "bytes_decompressed",
            "Bytes decompressed",
            Bytes,
            cache.bytes_decompressed,
        ),
        cumulative(
            "bytes_borrowed",
            "Bytes borrowed",
            Bytes,
            cache.bytes_borrowed,
        ),
        cumulative(
            "bytes_allocated",
            "Bytes allocated",
            Bytes,
            cache.bytes_allocated,
        ),
        cumulative("bytes_copied", "Bytes copied", Bytes, cache.bytes_copied),
        cumulative("filter_checks", "Filter checks", Count, cache.filter_checks),
        cumulative(
            "filter_negatives",
            "Filter negatives",
            Count,
            cache.filter_negatives,
        ),
    ];
    page_cache.extend(ratio(
        "filter_negative_ratio",
        "Filter negative ratio",
        cache.filter_negatives,
        cache.filter_checks,
    ));

    let memtable = &kv.memtable;
    let maintenance = &kv.maintenance;
    let segments = &kv.segment_set;
    let io = &kv.segment_io;
    let mut io_notes = vec![format!(
        "Requested read path: {}",
        label(&io.requested_mode)
    )];
    if let Some(reason) = &io.last_fallback_reason {
        io_notes.push(format!("Last fallback: {reason}"));
    }

    let mut cache_notes = Vec::new();
    if kv.segment_set.segments == 0 {
        cache_notes.push(format!(
            "No segments yet: every read is served from the memtable until it reaches {} versions or the write-ahead log reaches {}; the page cache serves segment reads after that flush.",
            grouped(kv.memtable.max_versions),
            binary_size(kv.write_ahead_log.payload_max_bytes)
        ));
    }
    let groups = vec![
        MetricGroupView {
            id: "page_cache",
            label: "Page cache",
            metrics: page_cache,
            notes: cache_notes,
        },
        MetricGroupView {
            id: "memtable",
            label: "Memtable",
            metrics: vec![
                filled(
                    "versions",
                    "Versions",
                    Count,
                    memtable.versions,
                    memtable.max_versions,
                ),
                gauge("keys", "Keys", Count, memtable.keys),
                gauge("tombstones", "Tombstones", Count, memtable.tombstones),
                gauge(
                    "approximate_bytes",
                    "Approximate size",
                    Bytes,
                    memtable.approximate_bytes,
                ),
                gauge(
                    "key_payload_bytes",
                    "Key payload",
                    Bytes,
                    memtable.key_payload_bytes,
                ),
                gauge(
                    "value_payload_bytes",
                    "Value payload",
                    Bytes,
                    memtable.value_payload_bytes,
                ),
                gauge(
                    "version_record_bytes",
                    "Version records",
                    Bytes,
                    memtable.version_record_bytes,
                ),
                gauge(
                    "owned_bytes_lower_bound",
                    "Owned bytes (lower bound)",
                    Bytes,
                    memtable.owned_bytes_lower_bound,
                ),
                gauge(
                    "spilled_chains",
                    "Spilled chains",
                    Count,
                    memtable.spilled_chains,
                ),
                gauge(
                    "spilled_version_capacity",
                    "Spilled version capacity",
                    Count,
                    memtable.spilled_version_capacity,
                ),
            ],
            notes: Vec::new(),
        },
        MetricGroupView {
            id: "write_ahead_log",
            label: "Write-ahead log",
            metrics: vec![filled(
                "payload",
                "Unflushed payload",
                Bytes,
                kv.write_ahead_log.payload_bytes,
                kv.write_ahead_log.payload_max_bytes,
            )],
            notes: Vec::new(),
        },
        MetricGroupView {
            id: "segments",
            label: "Segments",
            metrics: vec![
                gauge("segments", "Segments", Count, segments.segments),
                gauge(
                    "segment_bytes",
                    "Segment bytes",
                    Bytes,
                    segments.segment_bytes,
                ),
                filled(
                    "l0_segments",
                    "L0 segments",
                    Count,
                    segments.l0_segments,
                    segments.l0_compaction_trigger,
                ),
                gauge(
                    "compaction_debt_segments",
                    "Compaction debt",
                    Count,
                    segments.compaction_debt_segments,
                ),
                gauge(
                    "compaction_target_segment_bytes",
                    "Compaction target segment",
                    Bytes,
                    segments.compaction_target_segment_bytes,
                ),
            ],
            notes: Vec::new(),
        },
        MetricGroupView {
            id: "maintenance",
            label: "Flush and compaction",
            metrics: vec![
                cumulative(
                    "automatic_flushes",
                    "Automatic flushes",
                    Count,
                    maintenance.automatic_flushes,
                ),
                cumulative(
                    "failed_flushes",
                    "Failed flushes",
                    Count,
                    maintenance.failed_flushes,
                ),
                cumulative(
                    "write_stalls",
                    "Write stalls",
                    Count,
                    maintenance.write_stalls,
                ),
                cumulative(
                    "oversized_batches",
                    "Oversized batches",
                    Count,
                    maintenance.oversized_batches,
                ),
                cumulative(
                    "automatic_compactions",
                    "Automatic compactions",
                    Count,
                    maintenance.automatic_compactions,
                ),
                cumulative(
                    "failed_compactions",
                    "Failed compactions",
                    Count,
                    maintenance.failed_compactions,
                ),
                cumulative(
                    "compaction_input_bytes",
                    "Compaction input",
                    Bytes,
                    maintenance.compaction_input_bytes,
                ),
                cumulative(
                    "compaction_output_bytes",
                    "Compaction output",
                    Bytes,
                    maintenance.compaction_output_bytes,
                ),
                gauge(
                    "peak_compaction_buffer_bytes",
                    "Peak compaction buffer",
                    Bytes,
                    maintenance.peak_compaction_buffer_bytes,
                ),
            ],
            notes: Vec::new(),
        },
        MetricGroupView {
            id: "segment_io",
            label: "Segment I/O",
            metrics: vec![
                cumulative("read_operations", "Reads", Count, io.read_operations),
                cumulative("bytes_read", "Bytes read", Bytes, io.bytes_read),
                cumulative("mmap_reads", "mmap reads", Count, io.mmap_reads),
                cumulative("io_uring_reads", "io_uring reads", Count, io.io_uring_reads),
                cumulative("bounded_reads", "Bounded reads", Count, io.bounded_reads),
                gauge("mmap_segments", "mmap segments", Count, io.mmap_segments),
                gauge(
                    "io_uring_segments",
                    "io_uring segments",
                    Count,
                    io.io_uring_segments,
                ),
                gauge(
                    "bounded_segments",
                    "Bounded segments",
                    Count,
                    io.bounded_segments,
                ),
                cumulative("fallbacks", "Fallbacks", Count, io.fallbacks),
                filled(
                    "peak_request_bytes",
                    "Peak request",
                    Bytes,
                    io.peak_request_bytes,
                    io.max_request_bytes,
                ),
                filled(
                    "open_files",
                    "Open files",
                    Count,
                    io.open_files,
                    io.max_open_files,
                ),
                gauge(
                    "peak_open_files",
                    "Peak open files",
                    Count,
                    io.peak_open_files,
                ),
                cumulative(
                    "handle_evictions",
                    "Handle evictions",
                    Count,
                    io.handle_evictions,
                ),
                cumulative("handle_reopens", "Handle reopens", Count, io.handle_reopens),
                cumulative("handle_denials", "Handle denials", Count, io.handle_denials),
            ],
            notes: io_notes,
        },
        MetricGroupView {
            id: "sequences",
            label: "Sequences",
            metrics: vec![
                gauge(
                    "physical_sequence",
                    "Physical sequence",
                    Count,
                    kv.physical_sequence,
                ),
                gauge(
                    "durable_sequence",
                    "Durable sequence",
                    Count,
                    kv.durable_sequence,
                ),
                gauge(
                    "manifest_generation",
                    "Manifest generation",
                    Count,
                    kv.manifest_generation,
                ),
            ],
            notes: Vec::new(),
        },
    ];
    (headline, groups)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rrd_contract::{
        DiagnosticMaintenanceSnapshot, DiagnosticMemtableSnapshot, DiagnosticPageCacheSnapshot,
        DiagnosticSegmentIoMode, DiagnosticSegmentIoSnapshot, DiagnosticSegmentSetSnapshot,
        DiagnosticStorageEvidenceLevel, DiagnosticWriteAheadLogSnapshot, StorageProfileKind,
    };

    fn rrflow_kv() -> DiagnosticRrflowKvSnapshot {
        DiagnosticRrflowKvSnapshot {
            physical_sequence: 40,
            manifest_generation: 3,
            durable_sequence: 38,
            memtable: DiagnosticMemtableSnapshot {
                versions: 16,
                max_versions: 64,
                approximate_bytes: 4_096,
                keys: 12,
                key_payload_bytes: 512,
                value_payload_bytes: 2_048,
                tombstones: 1,
                spilled_chains: 0,
                spilled_version_capacity: 0,
                version_record_bytes: 1_024,
                owned_bytes_lower_bound: 3_584,
            },
            write_ahead_log: DiagnosticWriteAheadLogSnapshot {
                payload_bytes: 8_192,
                payload_max_bytes: 65_536,
            },
            maintenance: DiagnosticMaintenanceSnapshot {
                automatic_flushes: 2,
                failed_flushes: 0,
                write_stalls: 0,
                oversized_batches: 0,
                automatic_compactions: 1,
                failed_compactions: 0,
                compaction_input_bytes: 10_000,
                compaction_output_bytes: 9_000,
                peak_compaction_buffer_bytes: 4_096,
            },
            segment_set: DiagnosticSegmentSetSnapshot {
                segments: 2,
                segment_bytes: 20_000,
                l0_segments: 1,
                l0_compaction_trigger: 4,
                compaction_debt_segments: 0,
                compaction_target_segment_bytes: 1 << 26,
            },
            page_cache: DiagnosticPageCacheSnapshot {
                capacity_bytes: 1 << 20,
                resident_bytes: 1 << 18,
                entries: 8,
                hits: 90,
                misses: 10,
                evictions: 0,
                page_loads: 10,
                bytes_read: 40_960,
                bytes_decoded: 40_960,
                bytes_borrowed: 0,
                bytes_allocated: 40_960,
                bytes_copied: 0,
                bytes_decompressed: 0,
                filter_checks: 20,
                filter_negatives: 5,
            },
            segment_io: DiagnosticSegmentIoSnapshot {
                requested_mode: DiagnosticSegmentIoMode::Auto,
                mmap_segments: 0,
                io_uring_segments: 2,
                bounded_segments: 0,
                fallbacks: 0,
                last_fallback_reason: None,
                read_operations: 10,
                mmap_reads: 0,
                io_uring_reads: 10,
                bounded_reads: 0,
                bytes_read: 40_960,
                max_request_bytes: 1 << 20,
                peak_request_bytes: 4_096,
                max_open_files: 256,
                open_files: 2,
                peak_open_files: 3,
                handle_evictions: 1,
                handle_reopens: 1,
                handle_denials: 0,
            },
        }
    }

    fn admission(fenced: bool) -> DiagnosticStorageAdmission {
        DiagnosticStorageAdmission {
            checkpoint_entries: 3,
            checkpoint_limit: 64,
            native_transactions: 1,
            native_transaction_bytes: 2_048,
            active_read_views: 2,
            pinned_read_bytes: 8_192,
            retained_mutable_bytes: 4_096,
            retained_projected_bytes: 1_024,
            retained_source_bytes: 16_384,
            peak_source_bytes: 32_768,
            denied_source_allocations: 0,
            outstanding_requests: 2,
            outstanding_logical_bytes: 4_096,
            queued_requests: 1,
            active: true,
            fenced,
        }
    }

    #[test]
    fn segment_handles_and_admission_state_are_every_counter_the_engine_reports() {
        let view = physical(&DiagnosticStorageSnapshot {
            observed_at_unix_ms: 7,
            profile: StorageProfileKind::RrflowKv,
            evidence_level: DiagnosticStorageEvidenceLevel::RrflowKvCounters,
            rrflow_kv: Some(rrflow_kv()),
            admission: Some(admission(false)),
        });
        let metric = |group: &str, id: &str| {
            view.groups
                .iter()
                .find(|candidate| candidate.id == group)
                .and_then(|found| found.metrics.iter().find(|metric| metric.id == id))
                .unwrap_or_else(|| panic!("{group}/{id} is shown"))
        };
        let open = metric("segment_io", "open_files");
        assert_eq!((open.value, open.limit), (2.0, Some(256.0)));
        assert_eq!(metric("segment_io", "handle_evictions").value, 1.0);
        assert_eq!(metric("segment_io", "handle_denials").value, 0.0);
        let checkpoint = metric("admission", "checkpoint_entries");
        assert_eq!((checkpoint.value, checkpoint.limit), (3.0, Some(64.0)));
        assert_eq!(metric("admission", "queued_requests").value, 1.0);
        let notes = &view
            .groups
            .iter()
            .find(|group| group.id == "admission")
            .expect("admission group")
            .notes;
        assert!(notes
            .iter()
            .any(|note| note.contains("serialization permit")));
        assert!(!notes.iter().any(|note| note.starts_with("Fenced")));

        let fenced = physical(&DiagnosticStorageSnapshot {
            observed_at_unix_ms: 7,
            profile: StorageProfileKind::RrflowKv,
            evidence_level: DiagnosticStorageEvidenceLevel::RrflowKvCounters,
            rrflow_kv: Some(rrflow_kv()),
            admission: Some(admission(true)),
        });
        assert!(fenced
            .groups
            .iter()
            .find(|group| group.id == "admission")
            .expect("admission group")
            .notes
            .iter()
            .any(|note| note.starts_with("Fenced")));
    }

    #[test]
    fn rrflow_kv_counters_project_into_headline_gauges_and_groups() {
        let view = physical(&DiagnosticStorageSnapshot {
            observed_at_unix_ms: 7,
            profile: StorageProfileKind::RrflowKv,
            evidence_level: DiagnosticStorageEvidenceLevel::RrflowKvCounters,
            rrflow_kv: Some(rrflow_kv()),
            admission: None,
        });
        assert_eq!(view.profile, "rrflow_kv");
        assert_eq!(view.evidence_level, "rrflow_kv_counters");
        let hit_ratio = view
            .headline
            .iter()
            .find(|metric| metric.id == "page_cache_hit_ratio")
            .expect("hit ratio is defined once the cache served a lookup");
        assert!((hit_ratio.value - 0.9).abs() < f64::EPSILON);
        let resident = view
            .headline
            .iter()
            .find(|metric| metric.id == "page_cache_resident")
            .expect("cache residency gauge");
        assert_eq!(resident.limit, Some((1u64 << 20) as f64));
        let groups: Vec<&str> = view.groups.iter().map(|group| group.id).collect();
        assert_eq!(
            groups,
            [
                "page_cache",
                "memtable",
                "write_ahead_log",
                "segments",
                "maintenance",
                "segment_io",
                "sequences"
            ]
        );
        let io = view
            .groups
            .iter()
            .find(|group| group.id == "segment_io")
            .expect("segment I/O group");
        assert_eq!(io.notes, ["Requested read path: auto"]);
    }

    fn node(id: &str, label: &str) -> NodeView {
        NodeView {
            id: format!("document:{id}"),
            kind: "document".into(),
            key: id.into(),
            label: label.into(),
            valid_from_unix_ms: 1,
            properties: BTreeMap::new(),
            cluster: usize::MAX,
        }
    }

    #[test]
    fn clusters_are_named_after_their_most_linked_record() {
        let mut nodes: Vec<NodeView> = ["hub", "a", "b", "lone", "x", "y"]
            .iter()
            .map(|id| node(id, &id.to_uppercase()))
            .collect();
        // hub links to a and b, which also link to each other; x and y pair up.
        let links = [(0, 1), (0, 2), (1, 2), (2, 0), (4, 5)];
        let clusters = cluster_views(&mut nodes, &links);
        let names: Vec<(usize, usize, &str)> = clusters
            .iter()
            .map(|cluster| (cluster.id, cluster.size, cluster.label.as_str()))
            .collect();
        assert_eq!(names, [(0, 3, "HUB"), (1, 2, "X"), (2, 1, "LONE")]);
        assert_eq!(clusters[0].anchor, "document:hub");
        let membership: Vec<usize> = nodes.iter().map(|node| node.cluster).collect();
        assert_eq!(membership, [0, 0, 0, 2, 1, 1]);
        assert!(cluster_views(&mut [], &[]).is_empty());
    }

    #[test]
    fn nested_query_values_render_as_their_content() {
        let path = QueryValue::List(vec![
            QueryValue::String("document:a".into()),
            QueryValue::String("document:b".into()),
        ]);
        assert_eq!(display_value(&path), "[document:a, document:b]");
        let map = QueryValue::Map(
            [("depth".to_owned(), QueryValue::Unsigned(2))]
                .into_iter()
                .collect(),
        );
        assert_eq!(display_value(&map), "{depth: 2}");
    }

    #[test]
    fn idle_cache_explains_why_segment_reads_have_not_started() {
        let mut fresh = rrflow_kv();
        fresh.segment_set.segments = 0;
        fresh.memtable.max_versions = 524_288;
        fresh.write_ahead_log.payload_max_bytes = 64 << 20;
        let view = physical(&DiagnosticStorageSnapshot {
            observed_at_unix_ms: 7,
            profile: StorageProfileKind::RrflowKv,
            evidence_level: DiagnosticStorageEvidenceLevel::RrflowKvCounters,
            rrflow_kv: Some(fresh),
            admission: None,
        });
        let cache = view
            .groups
            .iter()
            .find(|group| group.id == "page_cache")
            .expect("page cache group");
        assert_eq!(cache.notes.len(), 1);
        assert!(cache.notes[0].contains("524,288 versions"));
        assert!(cache.notes[0].contains("64 MiB"));
        assert_eq!(grouped(0), "0");
        assert_eq!(grouped(1_000), "1,000");
        assert_eq!(binary_size(4 << 20), "4 MiB");
        assert_eq!(binary_size(1_500), "1,500 bytes");
    }

    #[test]
    fn idle_cache_and_logical_profiles_render_no_invented_values() {
        let mut idle = rrflow_kv();
        idle.page_cache.hits = 0;
        idle.page_cache.misses = 0;
        idle.page_cache.filter_checks = 0;
        let view = physical(&DiagnosticStorageSnapshot {
            observed_at_unix_ms: 7,
            profile: StorageProfileKind::RrflowKv,
            evidence_level: DiagnosticStorageEvidenceLevel::RrflowKvCounters,
            rrflow_kv: Some(idle),
            admission: None,
        });
        assert!(view
            .headline
            .iter()
            .all(|metric| metric.id != "page_cache_hit_ratio"));
        let logical = physical(&DiagnosticStorageSnapshot {
            observed_at_unix_ms: 7,
            profile: StorageProfileKind::RrflowMx,
            evidence_level: DiagnosticStorageEvidenceLevel::LogicalOnly,
            rrflow_kv: None,
            admission: None,
        });
        assert!(logical.headline.is_empty() && logical.groups.is_empty());
        assert_eq!(logical.evidence_level, "logical_only");
    }
}
