//! Lossless native webview values and explicit refusal classification.
use super::*;
use serde::Serialize;
use serde_json::Value;

/// Serialize validated contract objects without rounding u64 in the webview.
pub(super) fn projection(value: &impl Serialize) -> Result<Value, RrdError> {
    fn decimal(value: &mut Value) {
        match value {
            Value::Number(number) => *value = Value::String(number.to_string()),
            Value::Array(values) => values.iter_mut().for_each(decimal),
            Value::Object(values) => values.values_mut().for_each(decimal),
            _ => {}
        }
    }
    let mut value = serde_json::to_value(value).map_err(|error| error.to_string())?;
    decimal(&mut value);
    Ok(value)
}

// Only explicit pre-commit denials release a newly submitted command. Storage,
// internal, cancellation and availability failures may follow durable effects.
pub(super) fn definitive_denial(error: &rrd_client::Error) -> bool {
    use rrd_contract::ErrorCode;
    matches!(error, rrd_client::Error::Api { error, .. } if !error.retryable && matches!(error.code,
        ErrorCode::InvalidArgument | ErrorCode::NotFound | ErrorCode::AlreadyExists |
        ErrorCode::Conflict | ErrorCode::FailedPrecondition | ErrorCode::Unauthenticated |
        ErrorCode::PermissionDenied | ErrorCode::ResourceExhausted | ErrorCode::DeadlineExceeded |
        ErrorCode::UnsupportedVersion))
}

pub(super) fn unsigned(value: &str) -> Result<u64, RrdError> {
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err("expected an unsigned decimal integer".into());
    }
    value
        .parse()
        .map_err(|_| "integer exceeds the native range".into())
}
