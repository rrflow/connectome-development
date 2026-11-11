//! Project-scoped task controls. Reads never dispatch a provider or reset a budget.
use super::*;
use rrd_client::operations::{TaskBudgetResume, TaskEndpointPropose, TaskWorkerExecute};
use rrd_contract::{
    ConfigureTaskBudget, ContextReadStamp, CorrelationId, EndpointConfiguration,
    EndpointSelectionChoice, EndpointSelectionProposal, EndpointSelectionRequest,
    EndpointSelectionTask, ListTasks, OpenTask, QueryResult, QueryValue, ReadEndpointConfiguration,
    ReadTask, ReadTaskAttempt, ReadTaskBudget, ReasoningBudgetStop, ReasoningLimits,
    ResumeTaskBudget, StopTaskBudget, TaskAttemptStatus, TaskBudgetView, TaskRecord,
    TaskWorkerOutput, TaskWorkerRequest, TaskWorkerSourceProvenance, TaskWorkerSourceRequest,
    MAX_ROUTE_REQUEST_BYTES,
};
use serde::Serialize;

/// Local read ceilings; these do not supply model/provider or reasoning policy.
const TASK_PAGE_SIZE: u16 = 32;
const TASK_READ_KEYS: u64 = 10_000;
const SOURCE_QUERY_ROWS: u64 = 128;
const SOURCE_QUERY_OUTPUT_BYTES: u64 = 256 * 1024;
// RRFlow result identity v2: typed record family + kind + entry digest.
const SOURCE_RESULT_IDENTITY_VERSION: u16 = 2;

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum TaskCommand {
    List {
        after_cursor: String,
    },
    Open {
        title: String,
        goal: String,
    },
    Read {
        task_id: String,
    },
    Budget {
        task_id: String,
    },
    Configure {
        task_id: String,
        limits: ReasoningLimits,
    },
    Stop {
        task_id: String,
        expected_budget_sha256: String,
    },
    Resume {
        task_id: String,
        expected_budget_sha256: String,
    },
    Prepare {
        task_id: String,
    },
    Propose {
        task_id: String,
        attempt_id: String,
        expected_task_sha256: String,
        expected_configuration_sha256: String,
    },
    PrepareWorker {
        task_id: String,
        selection_attempt_id: String,
        #[serde(default)]
        source: Option<TaskWorkerSourceRequest>,
    },
    Sources {
        task_id: String,
    },
    Work {
        task_id: String,
        attempt_id: String,
        selection_attempt_id: String,
        expected_selection_sha256: String,
        expected_task_sha256: String,
        expected_configuration_sha256: String,
        #[serde(default)]
        source: Option<TaskWorkerSourceRequest>,
    },
    Attempt {
        task_id: String,
        attempt_id: String,
    },
}

#[derive(Debug, Serialize)]
pub struct TaskSummary {
    pub id: String,
    pub title: String,
    pub goal: String,
    pub status: String,
    pub cursor: String,
}
impl From<TaskRecord> for TaskSummary {
    fn from(task: TaskRecord) -> Self {
        Self {
            id: task.task_id.to_string(),
            title: task.title,
            goal: task.goal,
            status: task.status.as_str().into(),
            cursor: task.task_cursor.to_string(),
        }
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct BudgetSummary {
    pub sha256: String,
    pub max_steps: String,
    pub max_step_elapsed_ms: String,
    pub max_run_elapsed_ms: String,
    pub reserved_steps: String,
    pub charged_elapsed_ms: String,
    pub started_at_unix_ms: String,
    pub deadline_unix_ms: String,
    pub active_attempt: Option<String>,
    pub execution_may_continue: bool,
    pub stopped: Option<ReasoningBudgetStop>,
}
fn budget_view(view: TaskBudgetView) -> Option<BudgetSummary> {
    view.budget
        .zip(view.budget_sha256)
        .map(|(budget, sha256)| BudgetSummary {
            sha256,
            max_steps: budget.limits.max_steps.to_string(),
            max_step_elapsed_ms: budget.limits.max_step_elapsed_ms.to_string(),
            max_run_elapsed_ms: budget.limits.max_run_elapsed_ms.to_string(),
            reserved_steps: budget.reserved_steps.to_string(),
            charged_elapsed_ms: budget.charged_elapsed_ms.to_string(),
            started_at_unix_ms: budget.started_at_unix_ms.to_string(),
            deadline_unix_ms: budget.deadline_unix_ms.to_string(),
            active_attempt: budget.active_attempt.map(|id| id.as_str().to_owned()),
            execution_may_continue: budget.execution_may_continue,
            stopped: budget.stopped,
        })
}

#[derive(Debug, Serialize)]
pub struct ProposalSummary {
    pub attempt_id: String,
    pub task_sha256: String,
    pub configuration_sha256: String,
    pub controller_binding_id: String,
    pub service_id: String,
    pub choice: EndpointSelectionChoice,
    pub elapsed_ms: Option<String>,
    pub response_sha256: String,
}
impl From<EndpointSelectionProposal> for ProposalSummary {
    fn from(proposal: EndpointSelectionProposal) -> Self {
        Self {
            attempt_id: proposal.attempt_id.as_str().to_owned(),
            task_sha256: proposal.task_sha256,
            configuration_sha256: proposal.configuration_sha256,
            controller_binding_id: proposal.controller_binding_id.to_string(),
            service_id: proposal.service_id.to_string(),
            choice: proposal.choice,
            elapsed_ms: proposal.elapsed_ms.map(|n| n.to_string()),
            response_sha256: proposal.response_sha256,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct WorkerReview {
    pub selection_attempt_id: String,
    pub selection_sha256: String,
    pub task_sha256: String,
    pub configuration_sha256: String,
    pub binding_id: String,
    pub effort: Option<String>,
    pub wait_timeout_ms: String,
    pub source: Option<SourceReview>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct SourceCandidate {
    pub entry_identity: String,
    pub path: String,
    pub content_sha256: String,
    pub bytes: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct SourceInventory {
    pub entries: Vec<SourceCandidate>,
    pub read_cursor: String,
    pub read_manifest_sha256: String,
    pub result_identity_version: u16,
    pub truncated: bool,
    pub incomplete_rows: u64,
    pub unavailable_rows: u64,
    pub oversized_rows: u64,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct SourceReview {
    pub request: TaskWorkerSourceRequest,
    pub path: String,
    pub bytes: String,
    pub read_cursor: String,
    pub read_manifest_sha256: String,
    pub result_identity_version: u16,
}

#[derive(Debug, Serialize)]
pub struct WorkerSummary {
    pub attempt_id: String,
    pub selection_attempt_id: String,
    pub binding_id: String,
    pub service_id: String,
    pub content: String,
    pub content_sha256: String,
    pub response_sha256: String,
    pub task_sha256: String,
    pub configuration_sha256: String,
    pub elapsed_ms: Option<String>,
    pub source: Option<Box<WorkerSourceProvenanceSummary>>,
}

#[derive(Debug, Serialize)]
pub struct WorkerReadStampSummary {
    pub runtime_manifest_sha256: String,
    pub runtime_cursor: String,
    pub schema_revision: Option<String>,
    pub catalogue_revision: String,
}

impl From<ContextReadStamp> for WorkerReadStampSummary {
    fn from(read: ContextReadStamp) -> Self {
        Self {
            runtime_manifest_sha256: read.runtime_manifest_sha256,
            runtime_cursor: read.runtime_cursor.to_string(),
            schema_revision: read.schema_revision.map(|value| value.to_string()),
            catalogue_revision: read.catalogue_revision.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct WorkerSourceProvenanceSummary {
    pub contract_version: u16,
    pub captured_snapshot_sha256: String,
    pub captured_read: WorkerReadStampSummary,
    pub project_id: String,
    pub entry_identity: String,
    pub path_sha256: String,
    pub content_sha256: String,
    pub policy_sha256: String,
    pub profile_sha256: String,
    pub captured_at_unix_ms: String,
    pub validated_snapshot_sha256: String,
    pub validated_read: WorkerReadStampSummary,
    pub validated_at_unix_ms: String,
}

impl From<TaskWorkerSourceProvenance> for WorkerSourceProvenanceSummary {
    fn from(source: TaskWorkerSourceProvenance) -> Self {
        Self {
            contract_version: source.contract_version,
            captured_snapshot_sha256: source.captured_snapshot_sha256,
            captured_read: source.captured_read.into(),
            project_id: source.project_id.to_string(),
            entry_identity: source.entry_identity,
            path_sha256: source.path_sha256,
            content_sha256: source.content_sha256,
            policy_sha256: source.policy_sha256,
            profile_sha256: source.profile_sha256,
            captured_at_unix_ms: source.captured_at_unix_ms.to_string(),
            validated_snapshot_sha256: source.validated_snapshot_sha256,
            validated_read: source.validated_read.into(),
            validated_at_unix_ms: source.validated_at_unix_ms.to_string(),
        }
    }
}
impl From<TaskWorkerOutput> for WorkerSummary {
    fn from(output: TaskWorkerOutput) -> Self {
        Self {
            attempt_id: output.attempt_id.as_str().to_owned(),
            selection_attempt_id: output.selection_attempt_id.as_str().to_owned(),
            binding_id: output.binding_id.to_string(),
            service_id: output.service_id.to_string(),
            content: output.content,
            content_sha256: output.content_sha256,
            response_sha256: output.response_sha256,
            task_sha256: output.task_sha256,
            configuration_sha256: output.configuration_sha256,
            elapsed_ms: output.elapsed_ms.map(|n| n.to_string()),
            source: output.source.map(Into::into).map(Box::new),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TaskReply {
    NotDispatched {
        reason: String,
    },
    Page {
        tasks: Vec<TaskSummary>,
        truncated: bool,
        next_cursor: String,
    },
    Task {
        task: TaskSummary,
    },
    Budget {
        budget: Option<BudgetSummary>,
    },
    Prepared {
        task: TaskSummary,
        task_sha256: String,
        configuration_sha256: String,
        controller: Option<String>,
        candidates: Vec<String>,
        wait_timeout_ms: Option<String>,
        unavailable: Option<String>,
    },
    Proposal {
        proposal: ProposalSummary,
    },
    WorkerPrepared {
        review: WorkerReview,
    },
    Sources {
        inventory: SourceInventory,
    },
    Worker {
        worker: WorkerSummary,
    },
    Attempt {
        status: Option<TaskAttemptStatus>,
        proposal: Option<ProposalSummary>,
        worker: Option<WorkerSummary>,
    },
}

fn contract_error(error: impl fmt::Display) -> RrdError {
    error.to_string().into()
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn root_relative_source_path(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 4096
        && !value.starts_with('/')
        && !value.starts_with('\\')
        && !value.contains(':')
        && !value.contains('\0')
        && value
            .split(['/', '\\'])
            .all(|part| !part.is_empty() && part != "." && part != "..")
}

fn query_text_or_digest(value: Option<&QueryValue>) -> Option<&str> {
    match value {
        Some(QueryValue::String(value) | QueryValue::Digest(value)) => Some(value),
        _ => None,
    }
}

/// Leave time for engine admission/publication in addition to the provider timeout.
/// Refuse a duration the granted session cannot cover; never silently shorten it.
fn controller_timeout(configuration: &EndpointConfiguration) -> Result<Duration, RrdError> {
    let profile = configuration
        .profile
        .as_ref()
        .ok_or("No endpoint profile is configured")?;
    let policy = profile
        .selection_policy
        .as_ref()
        .ok_or("No controller policy is configured")?;
    let binding = profile
        .bindings
        .iter()
        .find(|b| b.id == policy.controller_binding_id)
        .ok_or("Configured controller binding is absent")?;
    Duration::from_millis(binding.limits.timeout_ms)
        .checked_add(REQUEST_TIMEOUT)
        .ok_or_else(|| "Controller timeout exceeds the native clock".into())
}

impl NativeRrdClient {
    async fn task_record(&self, task_id: &str) -> Result<TaskRecord, RrdError> {
        let request = ReadTask {
            scope: self.scope(),
            task_id: canonical(task_id, "task")?,
            max_storage_keys: TASK_READ_KEYS,
        };
        let result = self
            .send(false, |s, o| async move {
                self.client.read_task(&s, request, o).await
            })
            .await?;
        if result.task.task_id.as_str() != task_id || result.task.scope != self.scope() {
            return Err("Task readback changed the requested identity".into());
        }
        Ok(result.task)
    }

    async fn task_configuration(&self) -> Result<EndpointConfiguration, RrdError> {
        self.send(false, |s, o| async move {
            self.client
                .read_endpoint_configuration(&s, ReadEndpointConfiguration {}, o)
                .await
        })
        .await
    }

    /// Read typed inventory records through the existing public QueryExecute
    /// operation. This is a stored observation, not current-head authorization.
    async fn source_inventory(&self) -> Result<SourceInventory, RrdError> {
        let valid_at = now_unix_ms().map_err(contract_error)?;
        let mut budget = self.query_budget.clone();
        budget.max_storage_keys = budget.max_storage_keys.min(TASK_READ_KEYS);
        let row_cap = budget.max_rows.min(SOURCE_QUERY_ROWS);
        budget.max_rows = row_cap;
        budget.max_output_bytes = budget.max_output_bytes.min(SOURCE_QUERY_OUTPUT_BYTES);
        budget.max_batch_rows = budget.max_batch_rows.min(row_cap).max(1);
        budget.validate().map_err(contract_error)?;
        let query = format!(
            "FROM record:source-tree-entry AT VALID {valid_at} KNOWN HEAD PROJECT identity, path, source_file LIMIT {row_cap}"
        );
        let request = execute_query(&query, self.scope(), &budget)?;
        let result = self
            .send(false, |session, options| async move {
                self.client.execute_query(&session, request, options).await
            })
            .await?;
        Self::source_inventory_from_query(&self.scope(), result, row_cap)
    }

    fn source_inventory_from_query(
        expected_scope: &str,
        result: QueryResult,
        row_cap: u64,
    ) -> Result<SourceInventory, RrdError> {
        if result.scope != expected_scope {
            return Err("Source inventory query changed the project scope".into());
        }
        if !is_sha256(&result.read_manifest_sha256)
            || result.result_identity_version != SOURCE_RESULT_IDENTITY_VERSION
        {
            return Err("Source inventory query returned invalid read identity metadata".into());
        }
        if row_cap == 0
            || row_cap > SOURCE_QUERY_ROWS
            || result.rows.len() > row_cap as usize
            || result.execution.returned_rows != result.rows.len() as u64
            || result.execution.output_bytes > SOURCE_QUERY_OUTPUT_BYTES
            || result.execution.read_evidence.keys_examined > TASK_READ_KEYS
        {
            return Err("Source inventory query exceeded its bounded response".into());
        }

        let mut entries = Vec::new();
        let mut incomplete_rows = 0u64;
        let mut unavailable_rows = 0u64;
        let mut oversized_rows = 0u64;
        let mut identities = std::collections::BTreeSet::new();
        let mut paths = std::collections::BTreeSet::new();
        for row in &result.rows {
            if row
                .values
                .keys()
                .any(|key| key != "identity" && key != "path" && key != "source_file")
            {
                incomplete_rows += 1;
                continue;
            }
            let Some(identity) = query_text_or_digest(row.values.get("identity")) else {
                incomplete_rows += 1;
                continue;
            };
            let expected_row_identity = format!("record:source-tree-entry:{identity}");
            if row.identity != expected_row_identity
                || !is_sha256(identity)
                || !identities.insert(identity.to_owned())
            {
                incomplete_rows += 1;
                continue;
            }

            let source_file = match row.values.get("source_file") {
                None | Some(QueryValue::Null) => {
                    // The field can be absent on old schemas, redacted, or non-file.
                    // The public typed projection uses null for empty optional fields.
                    // Do not infer which case applies or select the row.
                    unavailable_rows += 1;
                    continue;
                }
                Some(QueryValue::Map(source_file)) => source_file,
                Some(_) => {
                    incomplete_rows += 1;
                    continue;
                }
            };
            let Some(path) = (match row.values.get("path") {
                Some(QueryValue::String(path)) => Some(path.as_str()),
                _ => None,
            }) else {
                incomplete_rows += 1;
                continue;
            };
            if !root_relative_source_path(path) || !paths.insert(path.to_owned()) {
                incomplete_rows += 1;
                continue;
            }
            if source_file.len() != 2
                || source_file
                    .keys()
                    .any(|key| key != "content_sha256" && key != "bytes")
            {
                incomplete_rows += 1;
                continue;
            }
            let (Some(QueryValue::String(content_sha256)), Some(QueryValue::Unsigned(bytes))) =
                (source_file.get("content_sha256"), source_file.get("bytes"))
            else {
                incomplete_rows += 1;
                continue;
            };
            if !is_sha256(content_sha256) {
                incomplete_rows += 1;
                continue;
            }
            if *bytes > MAX_ROUTE_REQUEST_BYTES {
                oversized_rows += 1;
                continue;
            }
            entries.push(SourceCandidate {
                entry_identity: identity.to_owned(),
                path: path.to_owned(),
                content_sha256: content_sha256.clone(),
                bytes: bytes.to_string(),
            });
        }
        entries.sort_by(|left, right| left.path.cmp(&right.path));
        Ok(SourceInventory {
            entries,
            read_cursor: result.known_at_cursor.to_string(),
            read_manifest_sha256: result.read_manifest_sha256,
            result_identity_version: result.result_identity_version,
            truncated: result.execution.truncated || result.execution.returned_rows >= row_cap,
            incomplete_rows,
            unavailable_rows,
            oversized_rows,
        })
    }

    /// Read-only review, not execution authority. RRFlow rechecks admission at dispatch.
    async fn worker_review(
        &self,
        task_id: &str,
        selection_attempt_id: &str,
        source: Option<TaskWorkerSourceRequest>,
    ) -> Result<(WorkerReview, Duration), RrdError> {
        let task = self.task_record(task_id).await?;
        let task_sha256 = EndpointSelectionTask::from_task(&task)
            .map_err(contract_error)?
            .task_sha256;
        let request = ReadTaskAttempt {
            scope: self.scope(),
            task_id: canonical(task_id, "task")?,
            attempt_id: CorrelationId::new(selection_attempt_id).map_err(contract_error)?,
        };
        let result = self
            .send(false, |s, o| async move {
                self.client.read_task_attempt(&s, request, o).await
            })
            .await?;
        result.validate().map_err(contract_error)?;
        let attempt = result.attempt.ok_or("No selection attempt is recorded")?;
        if attempt.status != TaskAttemptStatus::Accepted
            || attempt.attempt_id.as_str() != selection_attempt_id
        {
            return Err("Worker review requires the accepted selection attempt".into());
        }
        let selection_sha256 = attempt.outcome_sha256.ok_or("Selection digest is absent")?;
        let proposal = attempt
            .endpoint_proposal
            .ok_or("Attempt has no controller proposal")?;
        let config = self.task_configuration().await?;
        let configuration_sha256 = config.sha256().map_err(contract_error)?;
        if proposal.scope != self.scope()
            || proposal.task_id.as_str() != task_id
            || proposal.task_sha256 != task_sha256
            || proposal.configuration_sha256 != configuration_sha256
        {
            return Err("Selection inputs changed; review a fresh controller proposal".into());
        }
        let EndpointSelectionChoice::Select { binding_id, effort } = proposal.choice else {
            return Err("The controller abstained; no worker was selected".into());
        };
        let profile = config
            .profile
            .as_ref()
            .ok_or("No endpoint profile is configured")?;
        let worker = profile
            .worker_policy
            .as_ref()
            .and_then(|p| p.bindings.iter().find(|b| b.binding_id == binding_id))
            .ok_or("No worker policy is configured for the selected binding")?;
        worker
            .wire_effort(effort.as_deref())
            .map_err(contract_error)?;
        let binding = profile
            .bindings
            .iter()
            .find(|b| b.id == binding_id)
            .ok_or("Selected worker binding is absent")?;
        let source = if let Some(request) = source {
            request.validate().map_err(contract_error)?;
            if request.maximum_input_bytes > binding.limits.max_input_bytes {
                return Err(
                    "Selected source bound exceeds the configured worker input limit".into(),
                );
            }
            let inventory = self.source_inventory().await?;
            let candidate = inventory
                .entries
                .into_iter()
                .find(|entry| entry.entry_identity == request.entry_identity)
                .ok_or("Selected source is no longer present in typed inventory metadata")?;
            let bytes = candidate
                .bytes
                .parse::<u64>()
                .map_err(|_| "Selected source byte count is invalid")?;
            if candidate.content_sha256 != request.expected_content_sha256
                || bytes > request.maximum_input_bytes
            {
                return Err("Selected source changed or exceeds its reviewed input bound".into());
            }
            Some(SourceReview {
                request,
                path: candidate.path,
                bytes: candidate.bytes,
                read_cursor: inventory.read_cursor,
                read_manifest_sha256: inventory.read_manifest_sha256,
                result_identity_version: inventory.result_identity_version,
            })
        } else {
            None
        };
        let timeout = Duration::from_millis(binding.limits.timeout_ms)
            .checked_add(REQUEST_TIMEOUT)
            .ok_or("Worker timeout exceeds the native clock")?;
        self.check_controller_window(timeout)?;
        Ok((
            WorkerReview {
                selection_attempt_id: selection_attempt_id.into(),
                selection_sha256,
                task_sha256,
                configuration_sha256,
                binding_id: binding_id.to_string(),
                effort,
                wait_timeout_ms: timeout.as_millis().to_string(),
                source,
            },
            timeout,
        ))
    }

    pub async fn task_command(&self, command: TaskCommand) -> Result<TaskReply, RrdError> {
        match command {
            TaskCommand::List { after_cursor } => {
                let cursor = after_cursor
                    .parse()
                    .map_err(|_| "Invalid task page cursor")?;
                let request = ListTasks {
                    scope: self.scope(),
                    after_cursor: cursor,
                    limit: TASK_PAGE_SIZE,
                    max_storage_keys: TASK_READ_KEYS,
                };
                let page = self
                    .send(false, |s, o| async move {
                        self.client.list_tasks(&s, request, o).await
                    })
                    .await?;
                if page.scope != self.scope() || page.requested_after_cursor != cursor {
                    return Err("Task page changed the requested scope or cursor".into());
                }
                let next_cursor = page
                    .tasks
                    .last()
                    .map_or(cursor, |t| t.task_cursor)
                    .to_string();
                Ok(TaskReply::Page {
                    tasks: page.tasks.into_iter().map(Into::into).collect(),
                    truncated: page.truncated,
                    next_cursor,
                })
            }
            TaskCommand::Open { title, goal } => {
                let request = OpenTask {
                    scope: self.scope(),
                    title,
                    goal,
                };
                request.validate().map_err(contract_error)?;
                let expected = request.clone();
                let result = self
                    .send(true, |s, o| async move {
                        self.client.open_task(&s, request, o).await
                    })
                    .await?;
                if result.task.scope != expected.scope
                    || result.task.title != expected.title
                    || result.task.goal != expected.goal
                {
                    return Err("Opened task differs from the submitted task".into());
                }
                Ok(TaskReply::Task {
                    task: result.task.into(),
                })
            }
            TaskCommand::Read { task_id } => Ok(TaskReply::Task {
                task: self.task_record(&task_id).await?.into(),
            }),
            TaskCommand::Budget { task_id } => {
                let request = ReadTaskBudget {
                    scope: self.scope(),
                    task_id: canonical(&task_id, "task")?,
                };
                let result = self
                    .send(false, |s, o| async move {
                        self.client.read_task_budget(&s, request, o).await
                    })
                    .await?;
                self.checked_budget(result, &task_id)
            }
            TaskCommand::Configure { task_id, limits } => {
                let request = ConfigureTaskBudget {
                    scope: self.scope(),
                    task_id: canonical(&task_id, "task")?,
                    limits,
                    repetition_policy: None,
                };
                request.validate().map_err(contract_error)?;
                let result = self
                    .send(true, |s, o| async move {
                        self.client.configure_task_budget(&s, request, o).await
                    })
                    .await?;
                self.checked_budget(result, &task_id)
            }
            TaskCommand::Stop {
                task_id,
                expected_budget_sha256,
            } => {
                let request = StopTaskBudget {
                    scope: self.scope(),
                    task_id: canonical(&task_id, "task")?,
                    expected_budget_sha256,
                };
                request.validate().map_err(contract_error)?;
                let result = self
                    .send(true, |s, o| async move {
                        self.client.stop_task_budget(&s, request, o).await
                    })
                    .await?;
                self.checked_budget(result, &task_id)
            }
            TaskCommand::Resume {
                task_id,
                expected_budget_sha256,
            } => {
                let request = ResumeTaskBudget {
                    scope: self.scope(),
                    task_id: canonical(&task_id, "task")?,
                    expected_budget_sha256,
                };
                request.validate().map_err(contract_error)?;
                let result = self
                    .send(true, |s, o| async move {
                        self.client
                            .call_operation::<TaskBudgetResume>(&s, request, o)
                            .await
                    })
                    .await?;
                self.checked_budget(result, &task_id)
            }
            TaskCommand::Prepare { task_id } => {
                let task = self.task_record(&task_id).await?;
                let task_sha256 = EndpointSelectionTask::from_task(&task)
                    .map_err(contract_error)?
                    .task_sha256;
                let config = self.task_configuration().await?;
                let configuration_sha256 = config.sha256().map_err(contract_error)?;
                let policy = config
                    .profile
                    .as_ref()
                    .and_then(|p| p.selection_policy.as_ref());
                let timeout = controller_timeout(&config).and_then(|timeout| {
                    self.check_controller_window(timeout)?;
                    Ok(timeout)
                });
                let (wait_timeout_ms, unavailable) = match timeout {
                    Ok(t) => (Some(t.as_millis().to_string()), None),
                    Err(e) => (None, Some(e.message)),
                };
                Ok(TaskReply::Prepared {
                    task: task.into(),
                    task_sha256,
                    configuration_sha256,
                    controller: policy.map(|p| p.controller_binding_id.to_string()),
                    candidates: policy
                        .map(|p| {
                            p.candidates
                                .iter()
                                .map(|c| c.binding_id.to_string())
                                .collect()
                        })
                        .unwrap_or_default(),
                    wait_timeout_ms,
                    unavailable,
                })
            }
            TaskCommand::Propose {
                task_id,
                attempt_id,
                expected_task_sha256,
                expected_configuration_sha256,
            } => {
                let preflight: Result<_, RrdError> = async {
                let request = EndpointSelectionRequest {
                    scope: self.scope(),
                    task_id: canonical(&task_id, "task")?,
                    attempt_id: CorrelationId::new(&attempt_id).map_err(contract_error)?,
                    max_storage_keys: TASK_READ_KEYS,
                    expected_task_sha256,
                    expected_configuration_sha256,
                    flight: None,
                    routing: None,
                };
                request.validate().map_err(contract_error)?;
                let config = self.task_configuration().await?;
                if config.sha256().map_err(contract_error)? != request.expected_configuration_sha256
                {
                    return Err("Endpoint configuration changed; review it again before requesting a proposal".into());
                }
                let timeout = controller_timeout(&config)?;
                let margin = self.check_controller_window(timeout)?;
                let client = RrdClient::connect_local(
                    self.address,
                    self.instance.clone(),
                    ClientConfig {
                        request_timeout: timeout,
                        max_attempts: 1,
                        ..ClientConfig::default()
                    },
                )
                .map_err(RrdError::sdk)?;
                let lease = self.lease_for(margin).await?;
                let options = self.ids.next(true)?;
                Ok((client, lease, request, options))
                }.await;
                let (client, lease, request, options) = match preflight {
                    Ok(prepared) => prepared,
                    Err(error) => {
                        return Ok(TaskReply::NotDispatched {
                            reason: error.message,
                        })
                    }
                };
                // The SDK sends once. An error is not permission to create another attempt.
                let proposal = client
                    .call_operation::<TaskEndpointPropose>(&lease.session, request, options)
                    .await
                    .map_err(RrdError::sdk)?;
                Ok(TaskReply::Proposal {
                    proposal: proposal.into(),
                })
            }
            TaskCommand::PrepareWorker {
                task_id,
                selection_attempt_id,
                source,
            } => {
                let (review, _) = self
                    .worker_review(&task_id, &selection_attempt_id, source)
                    .await?;
                Ok(TaskReply::WorkerPrepared { review })
            }
            TaskCommand::Sources { task_id } => {
                // Bind this read to an existing task in the connected project.
                self.task_record(&task_id).await?;
                Ok(TaskReply::Sources {
                    inventory: self.source_inventory().await?,
                })
            }
            TaskCommand::Work {
                task_id,
                attempt_id,
                selection_attempt_id,
                expected_selection_sha256,
                expected_task_sha256,
                expected_configuration_sha256,
                source,
            } => {
                let preflight: Result<_, RrdError> = async {
                    let request = TaskWorkerRequest {
                        scope: self.scope(),
                        task_id: canonical(&task_id, "task")?,
                        attempt_id: CorrelationId::new(&attempt_id).map_err(contract_error)?,
                        selection_attempt_id: CorrelationId::new(&selection_attempt_id)
                            .map_err(contract_error)?,
                        expected_selection_sha256,
                        expected_task_sha256,
                        expected_configuration_sha256,
                        max_storage_keys: TASK_READ_KEYS,
                        context: None,
                        source: source.clone(),
                    };
                    request.validate().map_err(contract_error)?;
                    let (review, timeout) = self
                        .worker_review(&task_id, &selection_attempt_id, source)
                        .await?;
                    if review.selection_sha256 != request.expected_selection_sha256
                        || review.task_sha256 != request.expected_task_sha256
                        || review.configuration_sha256 != request.expected_configuration_sha256
                    {
                        return Err("Worker inputs changed; review the handoff again".into());
                    }
                    let margin = self.check_controller_window(timeout)?;
                    let client = RrdClient::connect_local(
                        self.address,
                        self.instance.clone(),
                        ClientConfig {
                            request_timeout: timeout,
                            max_attempts: 1,
                            ..ClientConfig::default()
                        },
                    )
                    .map_err(RrdError::sdk)?;
                    let lease = self.lease_for(margin).await?;
                    let options = self.ids.next(true)?;
                    Ok((client, lease, request, options))
                }
                .await;
                let (client, lease, request, options) = match preflight {
                    Ok(prepared) => prepared,
                    Err(error) => {
                        return Ok(TaskReply::NotDispatched {
                            reason: error.message,
                        })
                    }
                };
                // Contract-owned validation and a single SDK send; errors require readback.
                let output = client
                    .call_operation::<TaskWorkerExecute>(&lease.session, request, options)
                    .await
                    .map_err(RrdError::sdk)?;
                Ok(TaskReply::Worker {
                    worker: output.into(),
                })
            }
            TaskCommand::Attempt {
                task_id,
                attempt_id,
            } => {
                let request = ReadTaskAttempt {
                    scope: self.scope(),
                    task_id: canonical(&task_id, "task")?,
                    attempt_id: CorrelationId::new(&attempt_id).map_err(contract_error)?,
                };
                let result = self
                    .send(false, |s, o| async move {
                        self.client.read_task_attempt(&s, request, o).await
                    })
                    .await?;
                result.validate().map_err(contract_error)?;
                if let Some(attempt) = &result.attempt {
                    if attempt.attempt_id.as_str() != attempt_id
                        || attempt.endpoint_proposal.as_ref().is_some_and(|p| {
                            p.task_id.as_str() != task_id || p.scope != self.scope()
                        })
                        || attempt.worker_output.as_ref().is_some_and(|w| {
                            w.task_id.as_str() != task_id || w.scope != self.scope()
                        })
                    {
                        return Err("Attempt readback changed the requested identity".into());
                    }
                }
                Ok(TaskReply::Attempt {
                    status: result.attempt.as_ref().map(|a| a.status),
                    worker: result
                        .attempt
                        .as_ref()
                        .and_then(|a| a.worker_output.clone())
                        .map(Into::into),
                    proposal: result
                        .attempt
                        .and_then(|a| a.endpoint_proposal)
                        .map(Into::into),
                })
            }
        }
    }

    fn check_controller_window(&self, timeout: Duration) -> Result<Duration, RrdError> {
        let margin = timeout
            .checked_add(REQUEST_TIMEOUT)
            .ok_or("Controller session margin overflow")?;
        if margin
            >= Duration::from_millis(
                self.limits
                    .idle_timeout_ms
                    .min(self.limits.absolute_timeout_ms),
            )
        {
            return Err("Configured controller duration exceeds the native session window".into());
        }
        Ok(margin.max(SESSION_RENEWAL_MARGIN))
    }

    fn checked_budget(&self, view: TaskBudgetView, task_id: &str) -> Result<TaskReply, RrdError> {
        if view.budget.as_ref().is_some_and(|b| {
            b.task_id.as_str() != task_id
                || b.scope != self.scope()
                || b.instance_id != self.instance
        }) {
            return Err("Budget readback changed the requested identity".into());
        }
        Ok(TaskReply::Budget {
            budget: budget_view(view),
        })
    }
}

#[cfg(test)]
mod worker_projection_tests {
    use super::*;

    #[test]
    fn actual_retained_draft_projects_content_and_attempt_identity() {
        let captured: serde_json::Value = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/fixtures/task-worker-output.json"
        )))
        .expect("captured actual receipt");
        let output: TaskWorkerOutput =
            serde_json::from_value(captured["output"].clone()).expect("contract output");
        output.validate().expect("unaltered captured draft");
        let summary = WorkerSummary::from(output.clone());
        assert_eq!(summary.content, output.content);
        assert_eq!(summary.attempt_id, output.attempt_id.as_str());
        assert_eq!(
            summary.selection_attempt_id,
            output.selection_attempt_id.as_str()
        );
        assert_eq!(summary.content_sha256, output.content_sha256);
        assert_eq!(summary.elapsed_ms, output.elapsed_ms.map(|n| n.to_string()));
        let reply = serde_json::to_value(TaskReply::Worker { worker: summary }).unwrap();
        assert_eq!(reply["kind"], "worker");
        assert_eq!(reply["worker"]["content"], captured["output"]["content"]);
        // Explicit corruption probe, never a substitute provider response.
        let mut corrupted = output;
        corrupted.content.push('!');
        assert!(corrupted.validate().is_err());
    }
}

#[cfg(test)]
mod source_projection_tests {
    use super::*;
    use serde_json::{json, Value};

    fn query_row(identity: &str, path: &str, source_file: Option<Value>) -> Value {
        let mut values = serde_json::Map::from_iter([
            (
                "identity".to_owned(),
                json!({ "type": "string", "value": identity }),
            ),
            (
                "path".to_owned(),
                json!({ "type": "string", "value": path }),
            ),
        ]);
        if let Some(source_file) = source_file {
            values.insert("source_file".into(), source_file);
        }
        json!({
            "identity": format!("record:source-tree-entry:{identity}"),
            "values": values
        })
    }

    fn file_metadata(content_sha256: &str, bytes: u64) -> Value {
        json!({
            "type": "map",
            "value": {
                "content_sha256": { "type": "string", "value": content_sha256 },
                "bytes": { "type": "unsigned", "value": bytes },
            }
        })
    }

    fn query_result(rows: Vec<Value>, truncated: bool) -> QueryResult {
        let returned = rows.len() as u64;
        serde_json::from_value(json!({
            "canonical_query": "FROM record:source-tree-entry",
            "scope": "project:fixture",
            "read_manifest_sha256": "b".repeat(64),
            "known_at_cursor": 18446744073709551614u64,
            "result_identity_version": SOURCE_RESULT_IDENTITY_VERSION,
            "schema_revision": 3,
            "plan": {
                "plan_sha256": "c".repeat(64),
                "security_policy_revision": 1,
                "authorization_sha256": "d".repeat(64),
                "exact": true,
                "deterministic_order": "identity_ascending",
                "authorization_boundary": "allowed_fields_and_rows",
                "candidates": []
            },
            "execution": {
                "selected_versions": returned,
                "read_evidence": {
                    "contract_version": 1,
                    "key_budget": 10000,
                    "point_reads": 0,
                    "range_scans": 1,
                    "keys_examined": returned,
                    "values_decoded": returned,
                    "decoded_bytes": 64,
                    "stamp_validation": {
                        "method": "authenticated_current_head",
                        "change_reads": 0,
                        "proof_nodes": 0
                    },
                    "paths": []
                },
                "returned_rows": returned,
                "output_bytes": 256,
                "truncated": truncated,
                "analysis": null
            },
            "rows": rows
        }))
        .expect("typed QueryResult fixture")
    }

    #[test]
    fn accepts_only_exact_typed_file_map_and_preserves_read_identity_as_text() {
        let identity = "e".repeat(64);
        let content = "a".repeat(64);
        let result = query_result(
            vec![query_row(
                &identity,
                "src/lib.rs",
                Some(file_metadata(&content, 52)),
            )],
            true,
        );
        let inventory = NativeRrdClient::source_inventory_from_query(
            "project:fixture",
            result,
            SOURCE_QUERY_ROWS,
        )
        .expect("valid typed source row");
        assert_eq!(inventory.entries.len(), 1);
        assert_eq!(inventory.entries[0].entry_identity, identity);
        assert_eq!(inventory.entries[0].content_sha256, content);
        assert_eq!(inventory.entries[0].bytes, "52");
        assert_eq!(inventory.read_cursor, "18446744073709551614");
        assert!(inventory.truncated);
    }

    #[test]
    fn requires_canonical_typed_row_identity_and_marks_the_exact_row_cap_incomplete() {
        let identity = "e".repeat(64);
        let content = "a".repeat(64);
        let mut wrong_identity = query_result(
            vec![query_row(
                &identity,
                "src/lib.rs",
                Some(file_metadata(&content, 52)),
            )],
            false,
        );
        wrong_identity.rows[0].identity = identity.clone();
        let rejected = NativeRrdClient::source_inventory_from_query(
            "project:fixture",
            wrong_identity,
            SOURCE_QUERY_ROWS,
        )
        .expect("invalid rows remain a bounded partial result");
        assert!(rejected.entries.is_empty());
        assert_eq!(rejected.incomplete_rows, 1);

        let rows = (0..SOURCE_QUERY_ROWS)
            .map(|index| {
                let row_identity = format!("{index:064x}");
                query_row(
                    &row_identity,
                    &format!("src/{index}.rs"),
                    Some(file_metadata(&content, 52)),
                )
            })
            .collect();
        let capped = NativeRrdClient::source_inventory_from_query(
            "project:fixture",
            query_result(rows, false),
            SOURCE_QUERY_ROWS,
        )
        .expect("exact query cap is a valid but possibly incomplete inventory");
        assert_eq!(capped.entries.len(), SOURCE_QUERY_ROWS as usize);
        assert!(capped.truncated, "rows at the cap may hide more entries");

        let at_lower_cap = NativeRrdClient::source_inventory_from_query(
            "project:fixture",
            query_result(
                vec![
                    query_row(
                        &format!("{:064x}", 1),
                        "src/one.rs",
                        Some(file_metadata(&content, 52)),
                    ),
                    query_row(
                        &format!("{:064x}", 2),
                        "src/two.rs",
                        Some(file_metadata(&content, 52)),
                    ),
                ],
                false,
            ),
            2,
        )
        .expect("caller budget cap is accepted");
        assert!(at_lower_cap.truncated);
    }

    #[test]
    fn counts_missing_or_null_projection_as_unavailable_and_rejects_bad_rows() {
        let identity = "e".repeat(64);
        let content = "a".repeat(64);
        let mut malformed = file_metadata(&content, 52);
        malformed["value"]["extra"] = json!({ "type": "bool", "value": true });
        let mut rows = vec![
            query_row(&identity, "src/lib.rs", None),
            query_row(&identity, "src/other.rs", Some(malformed)),
            query_row(&identity, "src/lib.rs", Some(file_metadata(&content, 52))),
            query_row(
                &"d".repeat(64),
                "",
                Some(json!({ "type": "null", "value": null })),
            ),
            query_row(
                &"f".repeat(64),
                "src/wrong.rs",
                Some(json!({ "type": "string", "value": "not-a-map" })),
            ),
        ];
        let mut missing_path = query_row(&"c".repeat(64), "unused", None);
        missing_path["values"]
            .as_object_mut()
            .expect("row values")
            .remove("path");
        rows.push(missing_path);
        let mut null_path = query_row(
            &"b".repeat(64),
            "unused",
            Some(json!({ "type": "null", "value": null })),
        );
        null_path["values"]["path"] = json!({ "type": "null", "value": null });
        rows.push(null_path);
        let inventory = NativeRrdClient::source_inventory_from_query(
            "project:fixture",
            query_result(rows, false),
            SOURCE_QUERY_ROWS,
        )
        .expect("bounded query with unavailable rows");
        assert!(inventory.entries.is_empty());
        assert_eq!(inventory.incomplete_rows, 3);
        assert_eq!(inventory.unavailable_rows, 4);
    }

    #[test]
    fn refuses_scope_and_oversized_response_metadata() {
        let identity = "e".repeat(64);
        let content = "a".repeat(64);
        let result = query_result(
            vec![query_row(
                &identity,
                "src/lib.rs",
                Some(file_metadata(&content, 52)),
            )],
            false,
        );
        assert!(NativeRrdClient::source_inventory_from_query(
            "project:other",
            result,
            SOURCE_QUERY_ROWS,
        )
        .is_err());

        let oversized = NativeRrdClient::source_inventory_from_query(
            "project:fixture",
            query_result(
                vec![query_row(
                    &identity,
                    "src/large.bin",
                    Some(file_metadata(&content, MAX_ROUTE_REQUEST_BYTES + 1)),
                )],
                false,
            ),
            SOURCE_QUERY_ROWS,
        )
        .expect("oversized file is reported, not selectable");
        assert!(oversized.entries.is_empty());
        assert_eq!(oversized.oversized_rows, 1);
    }
}
