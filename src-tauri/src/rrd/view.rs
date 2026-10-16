//! Connectome view models projected from validated RRD responses.
//!
//! `rrd-contract` owns the wire schema. These structs carry only what the
//! Database, Vectors, and Storage lenses render, so the webview never decodes a
//! wire type and never receives a credential, token, or raw vector payload
//! larger than its preview.

use rrd_contract::{
    DataReference, DataVectorValue, DiagnosticRuntimeReference, DiagnosticSnapshot, QueryResult,
    QueryValue, ServiceCapabilities, VectorCollectionCatalogueSnapshot, VectorPointPage,
    VectorPointSnapshot, VectorSearchResult,
};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

/// Leading components shown for a vector; the full value stays native.
const VECTOR_PREVIEW_COMPONENTS: usize = 8;
/// Longest property text rendered before truncation.
const MAX_DISPLAY_TEXT: usize = 2048;

#[derive(Debug, Clone, Serialize)]
pub struct SessionView {
    pub session_id: String,
    pub issued_at_unix_ms: u64,
    pub idle_expires_at_unix_ms: u64,
    pub absolute_expires_at_unix_ms: u64,
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
}

#[derive(Debug, Serialize)]
pub struct NodeView {
    pub id: String,
    pub kind: String,
    pub key: String,
    pub label: String,
    pub valid_from_unix_ms: u64,
    pub properties: BTreeMap<String, String>,
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
    pub audit_through_sequence: u64,
    pub vector_artifacts: Vec<VectorArtifactView>,
    pub query_indexes: Vec<QueryIndexView>,
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
    bounded(match value {
        QueryValue::Null => "null".into(),
        QueryValue::Bool(value) => value.to_string(),
        QueryValue::Integer(value) => value.to_string(),
        QueryValue::Unsigned(value) => value.to_string(),
        QueryValue::Decimal(value) | QueryValue::String(value) | QueryValue::Digest(value) => {
            value.clone()
        }
        QueryValue::List(_) | QueryValue::Map(_) => {
            serde_json::to_string(value).unwrap_or_else(|_| "unrenderable value".into())
        }
    })
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
    let nodes: Vec<NodeView> = snapshot
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
            }
        })
        .collect();
    let known: BTreeSet<&str> = nodes.iter().map(|node| node.id.as_str()).collect();
    let edges = snapshot
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
        .filter(|edge| known.contains(edge.from.as_str()) && known.contains(edge.to.as_str()))
        .collect();
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
        audit_through_sequence: snapshot.audit.through_sequence,
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
    }
}
