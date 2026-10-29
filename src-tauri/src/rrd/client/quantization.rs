//! Quantized search generations: list them, propose and apply one lifecycle
//! step, and compare exact with approximate search.
//!
//! A generation is a rebuildable, compressed projection of one named vector.
//! Canonical vectors and exact search stay authoritative: an approximate
//! search selects candidates from a generation and reranks them exactly.
//!
//! Build, activation and retirement are governed effects. The webview
//! proposes a step and gets back the exact request under a handle; this
//! process sets its scope and key budget. Applying names only the handle.
//! Every attempt sends the same idempotency key, so the engine answers a retry
//! after a lost reply with the result it recorded instead of applying the step
//! again. One step is pending per connection, and a new proposal replaces it.

use super::transaction::outcome_unknown;
use super::*;
use crate::rrd::view::quantization::{
    self as views, ComparedSearchView, QuantizationAppliedView, QuantizationProposalView,
    QuantizationsView, VectorCompareView,
};
use rrd_contract::{
    ActivateVectorQuantizationArtifact, BuildVectorQuantizationArtifact,
    ListVectorQuantizationArtifacts, RetireVectorQuantizationArtifact, VectorQuantizationMethod,
    MAX_VECTOR_SEARCH_WORK,
};

/// Generations listed for one scope at most; the lens shows one named vector's.
const MAX_LISTED_GENERATIONS: u64 = 1_000;
/// Neighbours a comparison asks for at most.
const MAX_COMPARE_TOP_K: u64 = 100;
const NO_PENDING_STEP: &str =
    "this step is no longer pending: it was applied, discarded, or replaced by a newer proposal";

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdQuantizationsRequest {
    pub collection_id: String,
    pub vector_name: String,
}

/// One lifecycle step to propose. The webview chooses only what the operator
/// chooses; this process adds the scope and the key budget.
#[derive(Debug, Deserialize)]
#[serde(tag = "step", rename_all = "snake_case", deny_unknown_fields)]
pub enum RrdQuantizationProposeRequest {
    Build {
        collection_id: String,
        vector_name: String,
        method: VectorQuantizationMethod,
    },
    Activate {
        artifact_id: String,
        generation: u64,
    },
    Retire {
        artifact_id: String,
        generation: u64,
    },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdQuantizationApplyRequest {
    pub handle: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdVectorCompareRequest {
    pub collection_id: String,
    pub vector_name: String,
    /// Query by example: the stored point whose vector is the query.
    pub example: RrdReference,
    /// Neighbours to compare, not counting the query point.
    pub top_k: u64,
    /// Candidates the approximate search reranks exactly.
    pub exact_rerank: u64,
}

#[derive(Debug, Clone)]
pub(super) enum Step {
    Build(BuildVectorQuantizationArtifact),
    Activate(ActivateVectorQuantizationArtifact),
    Retire(RetireVectorQuantizationArtifact),
}

impl Step {
    fn name(&self) -> &'static str {
        match self {
            Self::Build(_) => "build",
            Self::Activate(_) => "activate",
            Self::Retire(_) => "retire",
        }
    }

    fn operation(&self) -> &'static str {
        match self {
            Self::Build(_) => "vector-quantization-build",
            Self::Activate(_) => "vector-quantization-activate",
            Self::Retire(_) => "vector-quantization-retire",
        }
    }

    fn request(&self) -> Result<serde_json::Value, RrdError> {
        let value = match self {
            Self::Build(request) => serde_json::to_value(request),
            Self::Activate(request) => serde_json::to_value(request),
            Self::Retire(request) => serde_json::to_value(request),
        };
        value.map_err(|error| format!("the quantization request does not encode: {error}").into())
    }

    fn validate(&self) -> Result<(), RrdError> {
        let valid = match self {
            Self::Build(request) => request.validate(),
            Self::Activate(request) => request.validate(),
            Self::Retire(request) => request.validate(),
        };
        valid.map_err(|error| error.to_string().into())
    }
}

/// A proposed step. The process tests send a held step themselves, as a
/// request whose reply was lost, so its step and options are visible to them.
pub(super) struct PendingStep {
    handle: String,
    pub(super) step: Step,
    /// Reused by every attempt, so a retry replays the first one.
    pub(super) options: RequestOptions,
}

/// The step `request` proposes, as this process sends it.
fn step(request: RrdQuantizationProposeRequest, scope: String) -> Result<Step, RrdError> {
    let step = match request {
        RrdQuantizationProposeRequest::Build {
            collection_id,
            vector_name,
            method,
        } => Step::Build(BuildVectorQuantizationArtifact {
            scope,
            collection_id: canonical(&collection_id, "collection")?,
            vector_name: canonical(&vector_name, "vector name")?,
            method,
            filter_properties: Vec::new(),
            max_storage_keys: MAX_VECTOR_STORAGE_KEYS,
        }),
        RrdQuantizationProposeRequest::Activate {
            artifact_id,
            generation,
        } => Step::Activate(ActivateVectorQuantizationArtifact {
            scope,
            artifact_id: canonical(&artifact_id, "quantization artifact")?,
            generation,
        }),
        RrdQuantizationProposeRequest::Retire {
            artifact_id,
            generation,
        } => Step::Retire(RetireVectorQuantizationArtifact {
            scope,
            artifact_id: canonical(&artifact_id, "quantization artifact")?,
            generation,
        }),
    };
    step.validate()?;
    Ok(step)
}

/// The rerank width of a comparison: at least the hits it asks for, which
/// include the query point, and within the engine's search bound.
fn rerank_width(top_k: u64, exact_rerank: u64) -> Result<u64, RrdError> {
    if top_k == 0 || top_k > MAX_COMPARE_TOP_K {
        return Err(format!("a comparison asks for 1..={MAX_COMPARE_TOP_K} neighbours").into());
    }
    let hits = top_k + 1;
    if exact_rerank < hits || exact_rerank > MAX_VECTOR_SEARCH_WORK {
        return Err(format!(
            "the exact rerank must cover the {hits} hits a comparison reads and stay within \
             {MAX_VECTOR_SEARCH_WORK}"
        )
        .into());
    }
    Ok(exact_rerank)
}

/// A search's hits without the query point, at most `top_k` of them.
fn neighbours(
    example: &DataReference,
    result: &VectorSearchResult,
    top_k: u64,
) -> crate::rrd::view::VectorSearchView {
    let mut search = view::search(example, result);
    search.hits.retain(|hit| {
        hit.reference.kind != example.kind.as_str() || hit.reference.id != example.id.as_str()
    });
    search
        .hits
        .truncate(usize::try_from(top_k).unwrap_or(usize::MAX));
    search
}

fn elapsed_ms(started: Instant) -> f64 {
    started.elapsed().as_secs_f64() * 1_000.0
}

impl NativeRrdClient {
    pub async fn quantizations(
        &self,
        request: RrdQuantizationsRequest,
    ) -> Result<QuantizationsView, RrdError> {
        let list = ListVectorQuantizationArtifacts {
            scope: self.scope(),
            collection_id: Some(canonical(&request.collection_id, "collection")?),
            vector_name: Some(canonical(&request.vector_name, "vector name")?),
            max_artifacts: MAX_LISTED_GENERATIONS,
        };
        let listed = self
            .send(false, |session, options| async move {
                self.client
                    .list_vector_quantizations(&session, list, options)
                    .await
            })
            .await?;
        Ok(views::quantizations(
            &request.collection_id,
            &request.vector_name,
            &listed,
            MAX_LISTED_GENERATIONS,
        ))
    }

    /// Holds the step `request` proposes under a new handle, replacing any
    /// step pending before it. Nothing is sent to the engine.
    pub async fn propose_quantization(
        &self,
        request: RrdQuantizationProposeRequest,
    ) -> Result<QuantizationProposalView, RrdError> {
        let step = step(request, self.scope())?;
        let handle = format!("quantization-{}", Uuid::new_v4().simple());
        let view = QuantizationProposalView {
            handle: handle.clone(),
            step: step.name().into(),
            operation: step.operation().into(),
            request: step.request()?,
        };
        *self.quantization.lock().await = Some(PendingStep {
            handle,
            step,
            options: self.ids.next(true)?,
        });
        Ok(view)
    }

    /// Applies the pending step named by `request.handle`, exactly as it was
    /// proposed. Only an attempt whose outcome is unknown keeps it pending,
    /// so that applying it again settles it.
    pub async fn apply_quantization(
        &self,
        request: RrdQuantizationApplyRequest,
    ) -> Result<QuantizationAppliedView, RrdError> {
        let mut pending = self.quantization.lock().await;
        let proposed = pending
            .as_ref()
            .filter(|proposed| proposed.handle == request.handle)
            .ok_or(NO_PENDING_STEP)?;
        let lease = self.lease().await?;
        let session = &lease.session;
        let options = proposed.options.clone();
        let name = proposed.step.name();
        let applied = match proposed.step.clone() {
            Step::Build(build) => self
                .client
                .build_vector_quantization(session, build, options)
                .await
                .map(|built| QuantizationAppliedView {
                    step: name.into(),
                    generation: views::generation(&built.artifact),
                    idempotent_replay: built.idempotent_replay,
                    selected_versions: Some(built.selected_versions),
                    keys_examined: Some(built.read_evidence.keys_examined),
                }),
            Step::Activate(activate) => self
                .client
                .activate_vector_quantization(session, activate, options)
                .await
                .map(|activated| QuantizationAppliedView {
                    step: name.into(),
                    generation: views::generation(&activated.artifact),
                    idempotent_replay: activated.idempotent_replay,
                    selected_versions: None,
                    keys_examined: None,
                }),
            Step::Retire(retire) => self
                .client
                .retire_vector_quantization(session, retire, options)
                .await
                .map(|retired| QuantizationAppliedView {
                    step: name.into(),
                    generation: views::generation(&retired.artifact),
                    idempotent_replay: retired.idempotent_replay,
                    selected_versions: None,
                    keys_examined: None,
                }),
        };
        drop(lease);
        match applied {
            Ok(view) => {
                *pending = None;
                Ok(view)
            }
            Err(error) if outcome_unknown(&error) => Err(RrdError::sdk(error)),
            Err(error) => {
                *pending = None;
                Err(RrdError::sdk(error))
            }
        }
    }

    /// Discards the pending step named by `handle`; nothing was sent for it.
    pub async fn discard_quantization(&self, handle: &str) -> Result<(), RrdError> {
        self.quantization
            .lock()
            .await
            .take_if(|proposed| proposed.handle == handle)
            .map(|_| ())
            .ok_or_else(|| NO_PENDING_STEP.into())
    }

    /// Exact and approximate search for one stored example, one after the
    /// other, each timed here. The approximate search requires a quantized
    /// generation; when the engine refuses it, the comparison carries its
    /// reason beside the exact list.
    pub async fn vector_compare(
        &self,
        request: RrdVectorCompareRequest,
    ) -> Result<VectorCompareView, RrdError> {
        let exact_rerank = rerank_width(request.top_k, request.exact_rerank)?;
        let collection_id = canonical(&request.collection_id, "collection")?;
        let vector_name = canonical(&request.vector_name, "vector name")?;
        let example = data_reference(&request.example)?;
        let valid_at = now_unix_ms()?;
        let batch = self
            .retrieve(RetrieveVectorPoints {
                scope: self.scope(),
                collection_id: collection_id.clone(),
                vector_name: vector_name.clone(),
                valid_at,
                references: vec![example.clone()],
                max_storage_keys: MAX_VECTOR_STORAGE_KEYS,
            })
            .await?;
        let point = batch
            .points
            .into_iter()
            .find(|point| point.reference == example)
            .ok_or("the example vector is not visible at the current read stamp")?;
        let DataVectorValue::Dense { values } = point.value else {
            return Err("query by example currently supports dense vectors only".into());
        };
        let search = |mode| SearchVectors {
            scope: self.scope(),
            valid_at,
            collection_id: Some(collection_id.clone()),
            vector_name: Some(vector_name.clone()),
            field: None,
            query: VectorSearchQuery::Dense {
                values: values.clone(),
            },
            filter: None,
            metric: None,
            // The query point is its own best match.
            top_k: request.top_k + 1,
            mode,
            max_storage_keys: MAX_VECTOR_STORAGE_KEYS,
        };

        // Both searches are timed the same way: the SDK call alone, with the
        // session already pinned.
        let lease = self.lease().await?;
        let exact_options = self.ids.next(false)?;
        let approximate_options = self.ids.next(false)?;
        let started = Instant::now();
        let exact = self
            .client
            .search_vectors(
                &lease.session,
                search(VectorSearchMode::Exact),
                exact_options,
            )
            .await;
        let exact_ms = elapsed_ms(started);
        let started = Instant::now();
        let approximate = self
            .client
            .search_vectors(
                &lease.session,
                search(VectorSearchMode::RequireApproximate {
                    exact_rerank,
                    ef_search: exact_rerank,
                }),
                approximate_options,
            )
            .await;
        let round_trip_ms = elapsed_ms(started);
        drop(lease);
        let exact = ComparedSearchView {
            round_trip_ms: exact_ms,
            search: neighbours(&example, &exact.map_err(RrdError::sdk)?, request.top_k),
        };
        let (approximate, approximate_refusal) = match approximate {
            Ok(result) => (
                Some(ComparedSearchView {
                    round_trip_ms,
                    search: neighbours(&example, &result, request.top_k),
                }),
                None,
            ),
            // The engine answered and refused, for example because no
            // generation is active: its reason belongs beside the exact list.
            Err(rrd_client::Error::Api { error, .. }) if !error.retryable => {
                (None, Some(error.message))
            }
            Err(error) => return Err(RrdError::sdk(error)),
        };
        let matched = approximate.as_ref().map_or(0, |side| {
            views::matched(&exact.search.hits, &side.search.hits)
        });
        Ok(VectorCompareView {
            query: view::reference(&example),
            top_k: request.top_k,
            recall: approximate
                .as_ref()
                .and_then(|_| views::recall(&exact.search.hits, matched)),
            same_cursor: approximate
                .as_ref()
                .is_some_and(|side| side.search.known_at_cursor == exact.search.known_at_cursor),
            matched,
            exact,
            approximate,
            approximate_refusal,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rrd_contract::VectorQuantizationBits;

    fn build(method: serde_json::Value) -> serde_json::Value {
        serde_json::json!({
            "step": "build",
            "collection_id": "notes",
            "vector_name": "body",
            "method": method,
        })
    }

    #[test]
    fn a_proposal_carries_only_what_the_operator_chooses() {
        let request: RrdQuantizationProposeRequest = serde_json::from_value(build(
            serde_json::json!({"method": "turbo_quant", "bits": "bits4", "seed": 7}),
        ))
        .expect("a build proposal");
        let Step::Build(built) = step(request, "instance:local".into()).expect("a valid build")
        else {
            panic!("a build proposal proposes a build");
        };
        assert_eq!(built.scope, "instance:local");
        assert_eq!(built.max_storage_keys, MAX_VECTOR_STORAGE_KEYS);
        assert!(built.filter_properties.is_empty());
        assert_eq!(
            built.method,
            VectorQuantizationMethod::TurboQuant {
                bits: VectorQuantizationBits::Bits4,
                seed: 7
            }
        );

        let mut scoped = build(serde_json::json!({"method": "scalar"}));
        scoped["scope"] = serde_json::json!("instance:other");
        assert!(
            serde_json::from_value::<RrdQuantizationProposeRequest>(scoped).is_err(),
            "the webview cannot choose the scope"
        );
        let mut budget = build(serde_json::json!({"method": "binary"}));
        budget["max_storage_keys"] = serde_json::json!(1);
        assert!(
            serde_json::from_value::<RrdQuantizationProposeRequest>(budget).is_err(),
            "the webview cannot choose the key budget"
        );
        assert!(
            serde_json::from_value::<RrdQuantizationProposeRequest>(build(
                serde_json::json!({"method": "turbo_quant", "bits": "bits3", "seed": 7})
            ))
            .is_err(),
            "only the contract's bit widths exist"
        );
        let apply: Result<RrdQuantizationApplyRequest, _> = serde_json::from_value(
            serde_json::json!({"handle": "quantization-1", "generation": 2}),
        );
        assert!(apply.is_err(), "applying names only the handle");
    }

    #[test]
    fn a_proposal_is_refused_before_it_is_held() {
        for (artifact_id, generation) in [("notes.body", 0), ("Not Canonical", 1)] {
            for step_name in ["activate", "retire"] {
                let request: RrdQuantizationProposeRequest =
                    serde_json::from_value(serde_json::json!({
                        "step": step_name,
                        "artifact_id": artifact_id,
                        "generation": generation,
                    }))
                    .expect("a lifecycle proposal");
                assert!(step(request, "instance:local".into()).is_err());
            }
        }
        let request: RrdQuantizationProposeRequest =
            serde_json::from_value(build(serde_json::json!({"method": "scalar"})))
                .expect("a build proposal");
        assert!(
            step(request, String::new()).is_err(),
            "the contract's own validation runs before a step is held"
        );
    }

    #[test]
    fn a_comparison_reranks_at_least_what_it_reads() {
        assert_eq!(rerank_width(10, 11).expect("the minimum"), 11);
        assert_eq!(rerank_width(10, 40).expect("wider"), 40);
        assert!(rerank_width(10, 10).is_err(), "the query point is read too");
        assert!(rerank_width(0, 8).is_err());
        assert!(rerank_width(MAX_COMPARE_TOP_K + 1, 1_000).is_err());
        assert!(rerank_width(10, MAX_VECTOR_SEARCH_WORK + 1).is_err());
    }
}
