//! One rrflowQL read: its request, the values its parameters stand for, and
//! what is refused here before anything is sent.

use super::*;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdQueryRequest {
    pub query: String,
    /// Values for the query's `$name` parameters, as the contract types them.
    #[serde(default)]
    pub parameters: BTreeMap<String, QueryValue>,
}

#[cfg(test)]
impl RrdQueryRequest {
    /// A query that names no parameters.
    pub fn new(query: impl Into<String>) -> Self {
        Self {
            query: query.into(),
            parameters: BTreeMap::new(),
        }
    }
}

/// One rrflowQL request within the engram's budget, refused before it is sent
/// when the contract could never accept it.
pub(super) fn execute_query(
    query: &str,
    scope: String,
    budget: &QueryBudget,
) -> Result<ExecuteQuery, RrdError> {
    if query.trim().is_empty() || query.len() > MAX_QUERY_BYTES || query.contains('\0') {
        return Err(format!(
            "RRFlowQL query must be non-empty, at most {MAX_QUERY_BYTES} bytes, and free of NUL"
        )
        .into());
    }
    Ok(ExecuteQuery {
        scope,
        query: query.to_owned(),
        parameters: Default::default(),
        budget: budget.clone(),
    })
}

/// Binds the caller's values to the query's `$name` parameters. The contract's
/// own limits (how many, how large, which names) refuse before anything is sent.
pub(super) fn with_parameters(
    mut execution: ExecuteQuery,
    parameters: BTreeMap<String, QueryValue>,
) -> Result<ExecuteQuery, RrdError> {
    execution.parameters = parameters;
    execution.validate().map_err(|error| error.to_string())?;
    Ok(execution)
}

impl NativeRrdClient {
    pub async fn query(&self, request: RrdQueryRequest) -> Result<QueryView, RrdError> {
        let execution = with_parameters(
            execute_query(&request.query, self.scope(), &self.query_budget)?,
            request.parameters,
        )?;
        let result = self
            .send(false, |session, options| async move {
                self.client
                    .execute_query(&session, execution, options)
                    .await
            })
            .await
            .map_err(|error| error.in_query(&request.query))?;
        Ok(view::query(&result))
    }
}
