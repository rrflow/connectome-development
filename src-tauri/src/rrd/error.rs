//! The error an authenticated RRD command returns to the webview.

use serde::Serialize;
use std::fmt;

/// A failed RRD command as the webview sees it. `retryable` is the engine's
/// own classification from its error contract: it marks a transient storage
/// conflict retryable (a diagnostic read that other requests kept changing),
/// so a lens can wait out a busy engine instead of reporting a failure.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RrdError {
    pub message: String,
    pub retryable: bool,
}

impl RrdError {
    /// Keeps the SDK's message and the engine's retry classification.
    pub fn sdk(error: rrd_client::Error) -> Self {
        let retryable = matches!(&error, rrd_client::Error::Api { error, .. } if error.retryable);
        Self {
            message: error.to_string(),
            retryable,
        }
    }
}

impl From<String> for RrdError {
    fn from(message: String) -> Self {
        Self {
            message,
            retryable: false,
        }
    }
}

impl From<&str> for RrdError {
    fn from(message: &str) -> Self {
        message.to_owned().into()
    }
}

impl fmt::Display for RrdError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::StatusCode;
    use rrd_contract::{ErrorBody, ErrorCode};

    fn api(code: ErrorCode, retryable: bool) -> rrd_client::Error {
        rrd_client::Error::Api {
            status: StatusCode::CONFLICT,
            error: ErrorBody {
                code,
                message: "diagnostic snapshot changed during all 3 assembly attempts".into(),
                retryable,
                details: Default::default(),
            },
        }
    }

    #[test]
    fn the_engine_decides_what_is_worth_retrying() {
        assert!(RrdError::sdk(api(ErrorCode::Conflict, true)).retryable);
        assert!(!RrdError::sdk(api(ErrorCode::Conflict, false)).retryable);
        assert!(!RrdError::sdk(rrd_client::Error::Timeout).retryable);
        assert!(!RrdError::from("local validation failed").retryable);
        assert!(RrdError::sdk(api(ErrorCode::Conflict, true))
            .message
            .contains("assembly attempts"));
    }
}
