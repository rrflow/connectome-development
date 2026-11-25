//! Bounded observations from a persisted prompt and the later read of its detail.
use crate::rrd::error::RrdError;
use rrd_contract::{
    ContextPlanStage, PromptFlightReadResult, PromptFlightUse, QueryValue, ReadEvidence,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ContextReads {
    pub key_budget: u64,
    pub keys_examined: u64,
    pub point_reads: u64,
    pub range_scans: u64,
    pub values_decoded: u64,
    pub decoded_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PromptFlightEventView {
    pub ordinal: u64,
    pub at_unix_ms: u64,
    pub elapsed_ms: u64,
    pub stage: String,
    pub label: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PromptFlightDetailView {
    pub flight_id: String,
    pub status: String,
    pub provider: String,
    pub context_mode: String,
    pub prompt: String,
    pub acceptance_marker: Option<String>,
    pub cohort_sha256: String,
    pub created_at_unix_ms: u64,
    pub flight_cursor: u64,
    pub known_at_cursor: u64,
    pub event_count: u64,
    pub context_items: u64,
    pub context_output_bytes: u64,
    pub elapsed_ms: u64,
    pub events: Vec<PromptFlightEventView>,
    pub scope: String,
    pub retrieval_cursor: u64,
    pub valid_at: u64,
    pub detail_cursor: u64,
    pub detail_reads: ReadEvidence,
    pub context_reads: Option<ContextReads>,
    pub stages: Vec<ContextPlanStage>,
    pub uses: Vec<PromptFlightUse>,
}

// Context events carry typed query values. Only their bounded diagnostic maps
// are projected here. Unexpected shapes must surface as a read error.
fn diagnostic_fields<T: DeserializeOwned>(value: &QueryValue) -> Result<T, RrdError> {
    let QueryValue::Map(fields) = value else {
        return Err("Flight diagnostic fields must be a map".into());
    };
    let mut object = serde_json::Map::new();
    for (name, value) in fields {
        let scalar = match value {
            QueryValue::String(text) | QueryValue::Digest(text) => Value::from(text.as_str()),
            QueryValue::Unsigned(number) => Value::from(*number),
            QueryValue::Bool(flag) => Value::from(*flag),
            _ => return Err(format!("Invalid value for flight diagnostic field {name}").into()),
        };
        object.insert(name.clone(), scalar);
    }
    serde_json::from_value(Value::Object(object))
        .map_err(|error| format!("Invalid recorded flight diagnostic: {error}").into())
}

pub fn detail(result: PromptFlightReadResult) -> Result<PromptFlightDetailView, RrdError> {
    let context = result
        .flight
        .events
        .iter()
        .find(|event| event.stage.as_str() == "context");
    let context_reads = context
        .and_then(|event| event.data.get("context_reads"))
        .map(diagnostic_fields)
        .transpose()?;
    let stages = match context.and_then(|event| event.data.get("stages")) {
        Some(QueryValue::List(items)) => items
            .iter()
            .map(diagnostic_fields)
            .collect::<Result<Vec<_>, _>>()?,
        Some(_) => return Err("Recorded retrieval stages must be a list".into()),
        None => Vec::new(),
    };
    let record = result.flight.record;
    let events = result
        .flight
        .events
        .into_iter()
        .map(|event| PromptFlightEventView {
            ordinal: event.ordinal,
            at_unix_ms: event.at_unix_ms,
            elapsed_ms: event.elapsed_ms,
            stage: event.stage.as_str().to_owned(),
            label: event.label,
            detail: event.detail,
        })
        .collect::<Vec<_>>();

    Ok(PromptFlightDetailView {
        flight_id: record.flight_id.as_str().to_owned(),
        status: record.status.as_str().to_owned(),
        provider: record.provider.as_str().to_owned(),
        context_mode: record.context_mode.as_str().to_owned(),
        prompt: record.prompt,
        acceptance_marker: record.acceptance_marker,
        cohort_sha256: record.cohort_sha256,
        created_at_unix_ms: record.created_at_unix_ms,
        flight_cursor: record.flight_cursor,
        known_at_cursor: record.known_at_cursor,
        event_count: record.event_count,
        context_items: record.metrics.context_items,
        context_output_bytes: record.metrics.context_output_bytes,
        elapsed_ms: record.metrics.elapsed_ms,
        scope: record.scope,
        retrieval_cursor: record.read.runtime_cursor,
        valid_at: record.context_request.valid_at,
        detail_cursor: result.read.runtime_cursor,
        detail_reads: result.read_evidence,
        context_reads,
        stages,
        uses: result.flight.uses,
        events,
    })
}
