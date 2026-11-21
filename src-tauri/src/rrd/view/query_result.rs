//! Query rows and the policy stamp returned with that execution.
use super::*;
use rrd_contract::ConfigurationAdmission;

#[derive(Debug, Serialize)]
pub struct AdmissionView {
    pub project_revision: String,
    pub project_configuration_sha256: String,
    pub evaluated_at_unix_ms: String,
    pub project_read_revision: String,
    pub project_policy: Option<RevisionView>,
    pub user: Option<UserView>,
}
#[derive(Debug, Serialize)]
pub struct RevisionView {
    pub read_revision: String,
    pub selected_revision: String,
    pub revision_sha256: String,
}
#[derive(Debug, Serialize)]
pub struct UserView {
    pub source_id: String,
    pub read_revision: String,
    pub selected_revision: String,
    pub revision_sha256: String,
}
impl From<&ConfigurationAdmission> for AdmissionView {
    fn from(value: &ConfigurationAdmission) -> Self {
        Self {
            project_revision: value.project_revision.to_string(),
            project_configuration_sha256: value.project_configuration_sha256.clone(),
            evaluated_at_unix_ms: value.evaluated_at_unix_ms.to_string(),
            project_read_revision: value.project_read_revision.to_string(),
            project_policy: value.project_policy.as_ref().map(|p| RevisionView {
                read_revision: p.read_revision.to_string(),
                selected_revision: p.selected_revision.to_string(),
                revision_sha256: p.revision_sha256.clone(),
            }),
            user: value.user.as_ref().map(|p| UserView {
                source_id: p.source_id.to_string(),
                read_revision: p.read_revision.to_string(),
                selected_revision: p.selected_revision.to_string(),
                revision_sha256: p.revision_sha256.clone(),
            }),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct QueryView {
    pub configuration: Option<AdmissionView>,
    pub canonical_query: String,
    pub known_at_cursor: u64,
    pub schema_revision: u64,
    pub columns: Vec<String>,
    pub rows: Vec<RowView>,
    pub returned_rows: u64,
    pub truncated: bool,
    pub keys_examined: u64,
    pub output_bytes: u64,
    /// The plan the engine bound: every access path it considered.
    pub plan: query_plan::QueryPlanView,
    /// What running that plan read and returned.
    pub execution: query_plan::QueryExecutionView,
}

pub fn query(result: &QueryResult) -> QueryView {
    let mut columns = BTreeSet::new();
    let rows = result
        .rows
        .iter()
        .map(|row| {
            columns.extend(row.values.keys().cloned());
            query_row(row)
        })
        .collect();
    QueryView {
        configuration: result.configuration.as_ref().map(AdmissionView::from),
        canonical_query: result.canonical_query.clone(),
        known_at_cursor: result.known_at_cursor,
        schema_revision: result.schema_revision,
        columns: columns.into_iter().collect(),
        rows,
        returned_rows: result.execution.returned_rows,
        truncated: result.execution.truncated,
        keys_examined: result.execution.read_evidence.keys_examined,
        output_bytes: result.execution.output_bytes,
        plan: query_plan::plan(&result.plan),
        execution: query_plan::execution(&result.execution),
    }
}
