//! Views of quantized search generations: the generations of one named
//! vector, a lifecycle step waiting for the operator and its outcome, and a
//! side-by-side comparison of exact and approximate search.
//!
//! A generation's method crosses as the contract's own value, because the
//! webview also builds one to propose a build. Everything else is projected
//! here, like every other view; vector values stay native.

use super::{HitView, ReferenceView, VectorSearchView};
use rrd_contract::{
    ListVectorQuantizationArtifactsResult, VectorQuantizationArtifactSnapshot,
    VectorQuantizationMethod,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct GenerationView {
    pub artifact_id: String,
    pub collection_id: String,
    pub vector_name: String,
    pub method: VectorQuantizationMethod,
    /// `ready`, `active` or `retired`.
    pub state: String,
    pub generation: u64,
    pub source_cursor: u64,
    pub indexed_vectors: u64,
    pub packed_vector_bytes: u64,
    pub full_precision_vector_bytes: u64,
    pub auxiliary_bytes: u64,
    pub maximum_compression_ratio: u64,
    pub configuration_sha256: String,
    pub artifact_sha256: String,
    pub object_sha256: String,
    pub object_length: u64,
    pub built_at_unix_ms: u64,
    pub lifecycle_revision: u64,
}

/// The generations of one named vector, by artifact and then newest first.
#[derive(Debug, Serialize)]
pub struct QuantizationsView {
    pub collection_id: String,
    pub vector_name: String,
    pub lifecycle_revision: u64,
    pub generations: Vec<GenerationView>,
    /// The engine returned as many generations as were asked for, so there
    /// may be more.
    pub truncated: bool,
}

/// A lifecycle step held natively under `handle` until the operator applies
/// or discards it. `request` is exactly what applying it sends.
#[derive(Debug, Serialize)]
pub struct QuantizationProposalView {
    /// Opaque to the webview; names the pending step in this process only.
    pub handle: String,
    /// `build`, `activate` or `retire`.
    pub step: String,
    /// The engine operation applying it calls.
    pub operation: String,
    pub request: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct QuantizationAppliedView {
    pub step: String,
    pub generation: GenerationView,
    /// The engine had already applied this step and returned its recorded
    /// result: a retry after a lost reply, not a second application.
    pub idempotent_replay: bool,
    /// For a build: the vector versions it encoded and the keys it read.
    pub selected_versions: Option<u64>,
    pub keys_examined: Option<u64>,
}

/// One side of a comparison: its search, without the query point, and its
/// round trip as this process measured it.
#[derive(Debug, Serialize)]
pub struct ComparedSearchView {
    pub search: VectorSearchView,
    pub round_trip_ms: f64,
}

/// Exact and approximate search for one example, side by side.
#[derive(Debug, Serialize)]
pub struct VectorCompareView {
    pub query: ReferenceView,
    pub top_k: u64,
    pub exact: ComparedSearchView,
    /// Absent when the engine refused to search approximately.
    pub approximate: Option<ComparedSearchView>,
    /// The engine's reason, when it refused.
    pub approximate_refusal: Option<String>,
    /// Approximate hits that are exact neighbours too.
    pub matched: u64,
    /// `matched` over the exact neighbours; absent without both lists.
    pub recall: Option<f64>,
    /// Both searches read the estate at the same cursor, so their lists
    /// compare one state.
    pub same_cursor: bool,
}

pub fn generation(snapshot: &VectorQuantizationArtifactSnapshot) -> GenerationView {
    GenerationView {
        artifact_id: snapshot.artifact_id.as_str().into(),
        collection_id: snapshot.collection_id.as_str().into(),
        vector_name: snapshot.vector_name.as_str().into(),
        method: snapshot.method.clone(),
        state: super::label(&snapshot.state),
        generation: snapshot.generation,
        source_cursor: snapshot.source_cursor,
        indexed_vectors: snapshot.indexed_vectors,
        packed_vector_bytes: snapshot.packed_vector_bytes,
        full_precision_vector_bytes: snapshot.full_precision_vector_bytes,
        auxiliary_bytes: snapshot.auxiliary_bytes,
        maximum_compression_ratio: snapshot.maximum_compression_ratio,
        configuration_sha256: snapshot.configuration_sha256.clone(),
        artifact_sha256: snapshot.artifact_sha256.clone(),
        object_sha256: snapshot.object_sha256.clone(),
        object_length: snapshot.object_length,
        built_at_unix_ms: snapshot.built_at_unix_ms,
        lifecycle_revision: snapshot.lifecycle_revision,
    }
}

pub fn quantizations(
    collection_id: &str,
    vector_name: &str,
    listed: &ListVectorQuantizationArtifactsResult,
    asked: u64,
) -> QuantizationsView {
    let mut generations: Vec<GenerationView> = listed
        .artifacts
        .iter()
        .filter(|artifact| {
            artifact.collection_id.as_str() == collection_id
                && artifact.vector_name.as_str() == vector_name
        })
        .map(generation)
        .collect();
    generations.sort_by(|a, b| {
        a.artifact_id
            .cmp(&b.artifact_id)
            .then(b.generation.cmp(&a.generation))
    });
    QuantizationsView {
        collection_id: collection_id.into(),
        vector_name: vector_name.into(),
        lifecycle_revision: listed.lifecycle_revision,
        truncated: u64::try_from(listed.artifacts.len()).unwrap_or(u64::MAX) >= asked,
        generations,
    }
}

/// How far apart two scores of one exact scorer may be and still tie.
const SCORE_TIE: f64 = 1e-6;

/// Approximate hits that are exact neighbours, counting ties at the cut.
///
/// Approximate hits are reranked by the exact scorer, so their scores are
/// exact. Neighbours that tie the exact list's last score are equally near,
/// and which of them the cut keeps is arbitrary. So a hit scoring above the
/// cut counts when it is an exact neighbour, and hits tying the cut count up
/// to the number of exact neighbours that tie it.
pub fn matched(exact: &[HitView], approximate: &[HitView]) -> u64 {
    let Some(cut) = exact.last().map(|hit| hit.score) else {
        return 0;
    };
    let ties = |hit: &&HitView| (hit.score - cut).abs() <= SCORE_TIE;
    let neighbour = |hit: &&HitView| {
        exact.iter().any(|neighbour| {
            neighbour.reference.kind == hit.reference.kind
                && neighbour.reference.id == hit.reference.id
        })
    };
    let above = approximate
        .iter()
        .filter(|hit| !ties(hit) && neighbour(hit))
        .count();
    let tied = approximate.iter().filter(ties).count();
    let slots = exact.iter().filter(ties).count();
    u64::try_from(above + tied.min(slots)).unwrap_or(u64::MAX)
}

pub fn recall(exact: &[HitView], matched: u64) -> Option<f64> {
    (!exact.is_empty()).then(|| matched as f64 / exact.len() as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hit(id: &str, score: f64) -> HitView {
        HitView {
            reference: ReferenceView {
                kind: "embedding".into(),
                id: id.into(),
            },
            subject: ReferenceView {
                kind: "note".into(),
                id: id.into(),
            },
            score,
            source_cursor: 1,
        }
    }

    #[test]
    fn recall_counts_exact_neighbours_and_ties_at_the_cut() {
        let exact = [hit("a", 0.9), hit("b", 0.8), hit("c", 0.7)];
        assert_eq!(matched(&exact, &exact), 3);
        assert_eq!(recall(&exact, 3), Some(1.0));

        // One true miss: d scores below the cut.
        let approximate = [hit("a", 0.9), hit("b", 0.8), hit("d", 0.6)];
        assert_eq!(matched(&exact, &approximate), 2);
        assert_eq!(recall(&exact, 2), Some(2.0 / 3.0));

        // d ties c, the exact list's last neighbour, so it is as near.
        let tied = [hit("a", 0.9), hit("b", 0.8), hit("d", 0.7)];
        assert_eq!(matched(&exact, &tied), 3);

        // Two hits tying the cut fill its one slot; they do not make up for
        // the nearer neighbour b that was missed.
        let two_ties = [hit("d", 0.7), hit("e", 0.7), hit("a", 0.9)];
        assert_eq!(matched(&exact, &two_ties), 2);

        // Order does not matter.
        let reordered = [hit("c", 0.7), hit("a", 0.9), hit("b", 0.8)];
        assert_eq!(matched(&exact, &reordered), 3);

        assert_eq!(matched(&[], &approximate), 0);
        assert_eq!(recall(&[], 0), None);
    }
}
