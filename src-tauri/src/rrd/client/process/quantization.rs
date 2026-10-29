//! Quantized search generations through the native client against a real RRD
//! process: the comparison is refused an approximate side until a generation
//! is active, a TurboQuant generation is built, activated, compared with exact
//! search and retired, a lost reply settles as the engine's replay, and a
//! spent or replaced handle applies nothing.
//!
//! Like the lens tests it installs and serves a fresh estate through the
//! product's serve path, loads the lens fixture, and is run by CI's RRD
//! process job with `--ignored`.

use super::*;
use crate::rrd::client::quantization::Step;
use crate::rrd::client::{
    RrdQuantizationApplyRequest, RrdQuantizationProposeRequest, RrdQuantizationsRequest,
    RrdVectorCompareRequest,
};

/// Neighbours compared: a1's three group mates.
const COMPARE_TOP_K: u64 = 3;
/// The narrowest rerank a comparison allows: its hits plus the query point.
const COMPARE_RERANK: u64 = COMPARE_TOP_K + 1;

fn listing() -> RrdQuantizationsRequest {
    RrdQuantizationsRequest {
        collection_id: FIXTURE_COLLECTION.into(),
        vector_name: FIXTURE_VECTOR.into(),
    }
}

fn comparison() -> RrdVectorCompareRequest {
    RrdVectorCompareRequest {
        collection_id: FIXTURE_COLLECTION.into(),
        vector_name: FIXTURE_VECTOR.into(),
        example: RrdReference {
            kind: "embedding".into(),
            id: "a1--body".into(),
        },
        top_k: COMPARE_TOP_K,
        exact_rerank: COMPARE_RERANK,
    }
}

fn proposal(value: Value) -> RrdQuantizationProposeRequest {
    serde_json::from_value(value).expect("a quantization proposal")
}

fn apply(handle: &str) -> RrdQuantizationApplyRequest {
    RrdQuantizationApplyRequest {
        handle: handle.into(),
    }
}

#[test]
#[ignore = "needs RRFLOW_BIN; run by CI's RRD process job"]
fn turboquant_generations_build_activate_compare_replay_and_retire() {
    let estate = Estate::install_and_serve();
    tauri::async_runtime::block_on(async {
        load_fixture(&estate).await;
        let client = NativeRrdClient::connect(estate.connect_request())
            .await
            .expect("connection");

        // Nothing is quantized yet: exact search answers alone, with the
        // engine's reason for refusing the approximate side.
        let listed = client.quantizations(listing()).await.expect("list");
        assert!(listed.generations.is_empty());
        let before = client.vector_compare(comparison()).await.expect("compare");
        assert!(before.exact.search.exact);
        assert_eq!(before.exact.search.access_path, "exact_scan");
        let exact_ids: Vec<&str> = before
            .exact
            .search
            .hits
            .iter()
            .map(|hit| hit.subject.id.as_str())
            .collect();
        assert_eq!(exact_ids.len(), COMPARE_TOP_K as usize);
        assert!(
            exact_ids
                .iter()
                .all(|id| id.starts_with('a') && *id != "a1"),
            "a1's exact neighbours are its group mates, without a1: {exact_ids:?}"
        );
        assert!(before.approximate.is_none());
        assert_eq!(before.recall, None);
        let refusal = before
            .approximate_refusal
            .expect("the engine says why it searched exactly");
        eprintln!("approximate search before activation: {refusal}");

        // A proposal holds the exact request and sends nothing.
        let built = client
            .propose_quantization(proposal(json!({
                "step": "build",
                "collection_id": FIXTURE_COLLECTION,
                "vector_name": FIXTURE_VECTOR,
                "method": { "method": "turbo_quant", "bits": "bits4", "seed": 7 },
            })))
            .await
            .expect("propose a build");
        assert_eq!(built.step, "build");
        assert_eq!(built.operation, "vector-quantization-build");
        assert_eq!(
            built.request["scope"],
            json!(format!("instance:{}", estate.instance))
        );
        assert_eq!(
            built.request["method"],
            json!({ "method": "turbo_quant", "bits": "bits4", "seed": 7 })
        );
        assert!(client
            .quantizations(listing())
            .await
            .expect("list")
            .generations
            .is_empty());

        // A lost reply: the build reaches the engine with the held request and
        // its idempotency key, and its answer never returns. Applying by the
        // handle then settles it as the engine's replay, not a second build.
        {
            let held = client.quantization.lock().await;
            let held = held.as_ref().expect("the proposal is held");
            let Step::Build(request) = held.step.clone() else {
                panic!("the held step is the proposed build");
            };
            let lease = client.lease().await.expect("lease");
            let first = client
                .client
                .build_vector_quantization(&lease.session, request, held.options.clone())
                .await
                .expect("the build whose reply is lost");
            assert!(!first.idempotent_replay);
        }
        let ready = client
            .apply_quantization(apply(&built.handle))
            .await
            .expect("apply the build");
        assert!(ready.idempotent_replay, "the retry replays the first build");
        let generation = ready.generation;
        assert_eq!(generation.state, "ready");
        assert_eq!(generation.generation, 1);
        assert_eq!(generation.indexed_vectors, DOCUMENTS as u64);
        assert_eq!(generation.maximum_compression_ratio, 8);
        assert!(generation.packed_vector_bytes < generation.full_precision_vector_bytes);
        assert!(
            client
                .apply_quantization(apply(&built.handle))
                .await
                .is_err(),
            "an applied step's handle is spent"
        );
        let listed = client.quantizations(listing()).await.expect("list");
        assert_eq!(listed.generations.len(), 1);
        assert_eq!(
            listed.generations[0].artifact_sha256,
            generation.artifact_sha256
        );

        // A ready generation is not served.
        let ready_compare = client.vector_compare(comparison()).await.expect("compare");
        assert!(ready_compare.approximate.is_none());

        // A newer proposal replaces the pending one, and discard ends it.
        let first = client
            .propose_quantization(proposal(json!({
                "step": "retire",
                "artifact_id": generation.artifact_id,
                "generation": generation.generation,
            })))
            .await
            .expect("propose a retirement");
        let activation = client
            .propose_quantization(proposal(json!({
                "step": "activate",
                "artifact_id": generation.artifact_id,
                "generation": generation.generation,
            })))
            .await
            .expect("propose an activation");
        assert!(
            client
                .apply_quantization(apply(&first.handle))
                .await
                .is_err(),
            "a replaced proposal applies nothing"
        );
        let active = client
            .apply_quantization(apply(&activation.handle))
            .await
            .expect("activate");
        assert!(!active.idempotent_replay);
        assert_eq!(active.generation.state, "active");

        // TurboQuant beside exact, at the narrowest rerank.
        let compared = client.vector_compare(comparison()).await.expect("compare");
        let approximate = compared
            .approximate
            .as_ref()
            .expect("an active generation serves the approximate side");
        assert_eq!(approximate.search.access_path, "turboquant");
        assert!(!approximate.search.exact);
        assert_eq!(approximate.search.selected_generation, Some(1));
        assert_eq!(approximate.search.exact_rerank, COMPARE_RERANK);
        assert!(approximate.search.loaded_artifact_bytes > 0);
        assert!(compared.same_cursor);
        assert_eq!(compared.matched, COMPARE_TOP_K);
        assert_eq!(compared.recall, Some(1.0));
        assert!(compared.exact.round_trip_ms > 0.0 && approximate.round_trip_ms > 0.0);
        eprintln!(
            "compared: exact {:.2} ms, {} keys; turboquant {:.2} ms, {} keys, {} of {} candidates",
            compared.exact.round_trip_ms,
            compared.exact.search.keys_examined,
            approximate.round_trip_ms,
            approximate.search.keys_examined,
            approximate.search.selected_candidates,
            approximate.search.canonical_candidates,
        );

        // Retired, the generation stops serving and the refusal returns.
        let retirement = client
            .propose_quantization(proposal(json!({
                "step": "retire",
                "artifact_id": generation.artifact_id,
                "generation": generation.generation,
            })))
            .await
            .expect("propose a retirement");
        client
            .discard_quantization(&retirement.handle)
            .await
            .expect("discard it");
        assert!(client
            .discard_quantization(&retirement.handle)
            .await
            .is_err());
        let retirement = client
            .propose_quantization(proposal(json!({
                "step": "retire",
                "artifact_id": generation.artifact_id,
                "generation": generation.generation,
            })))
            .await
            .expect("propose it again");
        let retired = client
            .apply_quantization(apply(&retirement.handle))
            .await
            .expect("retire");
        assert_eq!(retired.generation.state, "retired");
        let after = client.vector_compare(comparison()).await.expect("compare");
        assert!(after.approximate.is_none());
        assert!(after.approximate_refusal.is_some());
        let listed = client.quantizations(listing()).await.expect("list");
        assert_eq!(listed.generations.len(), 1);
        assert_eq!(listed.generations[0].state, "retired");

        client.close().await.expect("close the session");
    });
}
