//! The error an authenticated RRD command returns to the webview.

use rrd_contract::ErrorCode;
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
    /// Where the engine's parser refused the query a command sent.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<QueryErrorView>,
    /// The engine's own message when it refused an argument.
    #[serde(skip)]
    refusal: Option<String>,
}

/// A query the engine's parser refused, in the editor's terms.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct QueryErrorView {
    /// UTF-16 code units from the start of the query, as editors count.
    pub offset: usize,
    pub reason: String,
}

/// How the engine renders a parse refusal at the pinned revision: its query
/// error's debug form around the parser's message.
const PARSE_REFUSAL: (&str, &str) = ("Query(\"query parse error at byte ", "\")");

impl RrdError {
    /// Keeps the SDK's message and the engine's retry classification.
    pub fn sdk(error: rrd_client::Error) -> Self {
        let (retryable, refusal) = match &error {
            rrd_client::Error::Api { error, .. } => (
                error.retryable,
                (error.code == ErrorCode::InvalidArgument).then(|| error.message.clone()),
            ),
            _ => (false, None),
        };
        Self {
            message: error.to_string(),
            retryable,
            query: None,
            refusal,
        }
    }

    /// Locates a parse refusal of `query` in the query's own text.
    pub fn in_query(mut self, query: &str) -> Self {
        let parsed = self.refusal.as_deref().and_then(|message| {
            let (offset, reason) = message
                .strip_prefix(PARSE_REFUSAL.0)?
                .strip_suffix(PARSE_REFUSAL.1)?
                .split_once(": ")?;
            Some((offset.parse::<usize>().ok()?, unescape_debug(reason)?))
        });
        if let Some((offset, reason)) = parsed {
            self.query = Some(QueryErrorView {
                offset: utf16_offset(query, offset),
                reason,
            });
        }
        self
    }
}

/// UTF-16 code units before byte `offset` of `text`. An offset inside a
/// character counts that character: the engine reports "end of query" one
/// byte past the start of the last token, which can fall inside it.
fn utf16_offset(text: &str, offset: usize) -> usize {
    text.char_indices()
        .take_while(|(start, _)| *start < offset)
        .map(|(_, character)| character.len_utf16())
        .sum()
}

/// Reverses `str::escape_debug`, which is how the engine's message quotes the
/// parser's: `\t`, `\r`, `\n`, `\\`, `\"`, `\'`, `\0` and `\u{…}`.
fn unescape_debug(text: &str) -> Option<String> {
    let mut out = String::with_capacity(text.len());
    let mut characters = text.chars();
    while let Some(character) = characters.next() {
        if character != '\\' {
            out.push(character);
            continue;
        }
        out.push(match characters.next()? {
            't' => '\t',
            'r' => '\r',
            'n' => '\n',
            '0' => '\0',
            escaped @ ('\\' | '"' | '\'') => escaped,
            'u' => {
                if characters.next()? != '{' {
                    return None;
                }
                let hex: String = characters.by_ref().take_while(|&c| c != '}').collect();
                char::from_u32(u32::from_str_radix(&hex, 16).ok()?)?
            }
            _ => return None,
        });
    }
    Some(out)
}

impl From<String> for RrdError {
    fn from(message: String) -> Self {
        Self {
            message,
            retryable: false,
            query: None,
            refusal: None,
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
    use rrd_contract::ErrorBody;

    fn api(code: ErrorCode, message: &str, retryable: bool) -> rrd_client::Error {
        rrd_client::Error::Api {
            status: StatusCode::CONFLICT,
            error: ErrorBody {
                code,
                message: message.into(),
                retryable,
                details: Default::default(),
            },
        }
    }

    fn refused(message: &str) -> RrdError {
        RrdError::sdk(api(ErrorCode::InvalidArgument, message, false))
    }

    #[test]
    fn the_engine_decides_what_is_worth_retrying() {
        let busy = "diagnostic snapshot changed during all 3 assembly attempts";
        assert!(RrdError::sdk(api(ErrorCode::Conflict, busy, true)).retryable);
        assert!(!RrdError::sdk(api(ErrorCode::Conflict, busy, false)).retryable);
        assert!(!RrdError::sdk(rrd_client::Error::Timeout).retryable);
        assert!(!RrdError::from("local validation failed").retryable);
        assert!(RrdError::sdk(api(ErrorCode::Conflict, busy, true))
            .message
            .contains("assembly attempts"));
    }

    #[test]
    fn a_parse_refusal_is_located_in_the_query_as_editors_count() {
        // "é" is two bytes and one UTF-16 unit; "𝄞" is four bytes and two.
        let query = "FROM record:é𝄞 AT VALID 1 KNOWN HEAD PROJECT * LIMIT 0x";
        let at = |byte: usize| {
            refused(&format!(
                r#"Query("query parse error at byte {byte}: unexpected token \"0x\"")"#
            ))
            .in_query(query)
            .query
            .expect("located")
        };
        assert_eq!(
            at(0),
            QueryErrorView {
                offset: 0,
                reason: "unexpected token \"0x\"".into()
            }
        );
        assert_eq!(at(12).offset, 12, "ASCII before the multibyte characters");
        assert_eq!(at(14).offset, 13, "after é");
        assert_eq!(at(18).offset, 15, "after 𝄞");
        assert_eq!(at(13).offset, 13, "inside é counts é");
        assert_eq!(at(16).offset, 15, "inside 𝄞 counts 𝄞");
        assert_eq!(at(10_000).offset, query.encode_utf16().count());
    }

    #[test]
    fn only_a_parse_refusal_of_an_argument_is_located() {
        let message = r#"Query("query parse error at byte 0: expected FROM, found end of query")"#;
        assert!(refused(message).in_query("").query.is_some());
        for unlocated in [
            RrdError::sdk(api(ErrorCode::FailedPrecondition, message, false)),
            refused(r#"Query("unknown record type \"document\"")"#),
            refused(r#"Query("query parse error at byte x: reason")"#),
            refused(r#"Query("query parse error at byte 1 reason")"#),
            refused(r#"Query("query parse error at byte 1: bad \q escape")"#),
            RrdError::from(message),
        ] {
            assert_eq!(
                unlocated.clone().in_query("FROM").query,
                None,
                "{unlocated}"
            );
        }
    }

    #[test]
    fn the_parsers_message_is_unquoted_exactly() {
        assert_eq!(
            unescape_debug(r#"expected \"x\" \\ \t\r\n \' \0 \u{7f} é"#).as_deref(),
            Some("expected \"x\" \\ \t\r\n ' \0 \u{7f} é")
        );
        for refused in [r"\", r"\q", r"\u7f", r"\u{110000}", r"\u{zz}"] {
            assert_eq!(unescape_debug(refused), None, "{refused}");
        }
    }

    #[test]
    fn the_location_reaches_the_webview_and_the_engine_message_does_not() {
        let message =
            r#"Query("query parse error at byte 5: expected source family, found end of query")"#;
        let error = serde_json::to_value(refused(message).in_query("FROM ")).expect("json");
        assert_eq!(
            error["query"],
            serde_json::json!({ "offset": 5, "reason": "expected source family, found end of query" })
        );
        assert!(error.get("refusal").is_none());
        assert!(serde_json::to_value(RrdError::from("x"))
            .expect("json")
            .get("query")
            .is_none());
    }
}
