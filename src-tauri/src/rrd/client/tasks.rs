//! Project-scoped task controls. Reads never dispatch a provider or reset a budget.
use super::*;
use rrd_client::operations::TaskEndpointPropose;
use rrd_contract::{
    ConfigureTaskBudget, CorrelationId, EndpointConfiguration, EndpointSelectionChoice,
    EndpointSelectionProposal, EndpointSelectionRequest, EndpointSelectionTask, ListTasks,
    OpenTask, ReadEndpointConfiguration, ReadTask, ReadTaskAttempt, ReadTaskBudget,
    ReasoningBudgetStop, ReasoningLimits, StopTaskBudget, TaskAttemptStatus, TaskBudgetView,
    TaskRecord,
};
use serde::Serialize;

/// Local read ceilings; these do not supply model/provider or reasoning policy.
const TASK_PAGE_SIZE: u16 = 32;
const TASK_READ_KEYS: u64 = 10_000;

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
    Prepare {
        task_id: String,
    },
    Propose {
        task_id: String,
        attempt_id: String,
        expected_task_sha256: String,
        expected_configuration_sha256: String,
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

#[derive(Debug, Serialize)]
pub struct BudgetSummary {
    pub sha256: String,
    pub max_steps: String,
    pub max_step_elapsed_ms: String,
    pub max_run_elapsed_ms: String,
    pub reserved_steps: String,
    pub charged_elapsed_ms: String,
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
    Attempt {
        status: Option<TaskAttemptStatus>,
        proposal: Option<ProposalSummary>,
    },
}

fn contract_error(error: impl fmt::Display) -> RrdError {
    error.to_string().into()
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
                if let Some(attempt) = &result.attempt {
                    if attempt.attempt_id.as_str() != attempt_id
                        || attempt.endpoint_proposal.as_ref().is_some_and(|p| {
                            p.task_id.as_str() != task_id || p.scope != self.scope()
                        })
                    {
                        return Err("Attempt readback changed the requested identity".into());
                    }
                }
                Ok(TaskReply::Attempt {
                    status: result.attempt.as_ref().map(|a| a.status),
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
