import {
	Alert,
	Badge,
	Button,
	Checkbox,
	Code,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { RRD_PROTOCOL, RRD_PROTOCOL_VERSION, RrdRuntimeClient } from "~/rrflow/runtime";
import type { RrdSessionClient } from "~/rrflow/session";
import {
	type AssessmentDescriptor,
	readTaskRecovery,
	type SourceCandidate,
	type SourceInventory,
	type TaskAssessmentOutput,
	type TaskBudget,
	type TaskProposal,
	type TaskRecovery,
	type TaskReply,
	type TaskSummary,
	type TaskWorkerSourceRequest,
	type WorkerDraft,
	WorkerDraftCache,
	type WorkerReview,
} from "~/rrflow/tasks";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
function supportsTaskAssessmentOperations(
	catalogue: Awaited<ReturnType<RrdRuntimeClient["catalogue"]>>,
) {
	if (catalogue.protocol !== RRD_PROTOCOL || catalogue.protocol_version !== RRD_PROTOCOL_VERSION)
		return false;
	const execute = catalogue.endpoints.find(
		(endpoint) => endpoint.operation === "task-assessment-execute",
	);
	const read = catalogue.endpoints.find(
		(endpoint) => endpoint.operation === "task-assessment-read",
	);
	return (
		execute?.method === "post" &&
		execute.authentication === "session_bearer" &&
		execute.mutation &&
		read?.method === "post" &&
		read.authentication === "session_bearer" &&
		!read.mutation
	);
}
const positiveInteger = (value: string) => {
	const number = Number(value);
	if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number <= 0)
		throw new Error("Budget fields must be positive whole numbers");
	return number;
};
function assessmentDescriptor(
	mode: string,
	fields: {
		proposition: string;
		question: string;
		options: string;
		rubric: string;
		minimum: string;
		maximum: string;
		direction: "higher_is_better" | "lower_is_better";
	},
): AssessmentDescriptor {
	if (mode === "binary") return { mode, proposition: fields.proposition.trim() };
	if (mode === "choice") {
		const options = fields.options
			.split("\n")
			.map((description) => description.trim())
			.filter(Boolean)
			.map((description, index) => ({ id: `option-${index + 1}`, description }));
		return { mode, question: fields.question.trim(), options };
	}
	return {
		mode: "score",
		rubric: fields.rubric.trim(),
		minimum: Number(fields.minimum),
		maximum: Number(fields.maximum),
		direction: fields.direction,
	};
}
function assessmentOutcomeText(output: TaskAssessmentOutput): string {
	if (output.decision.outcome === "abstained") return `Abstained — ${output.decision.reason}`;
	const value = output.decision.value;
	if (value.kind === "binary") return `Yes/no answer — ${value.value ? "Yes" : "No"}`;
	if (value.kind === "choice") {
		const description =
			output.descriptor.mode === "choice"
				? output.descriptor.options.find((option) => option.id === value.option_id)
						?.description
				: null;
		return `Choice — ${description ?? "Recorded option is unavailable"}`;
	}
	const direction =
		output.descriptor.mode === "score"
			? output.descriptor.direction === "higher_is_better"
				? "higher is better"
				: "lower is better"
			: "bounded score";
	return `Score — ${value.value} (${direction})`;
}
function preservesBudgetHistory(before: TaskBudget, after: TaskBudget): boolean {
	return (
		before.max_steps === after.max_steps &&
		before.max_step_elapsed_ms === after.max_step_elapsed_ms &&
		before.max_run_elapsed_ms === after.max_run_elapsed_ms &&
		before.reserved_steps === after.reserved_steps &&
		before.charged_elapsed_ms === after.charged_elapsed_ms &&
		before.started_at_unix_ms === after.started_at_unix_ms &&
		before.deadline_unix_ms === after.deadline_unix_ms &&
		JSON.stringify(before.repetition_policy) === JSON.stringify(after.repetition_policy) &&
		after.stopped === null &&
		after.active_attempt === null &&
		!after.execution_may_continue &&
		JSON.stringify(before.equivalent_attempts) === JSON.stringify(after.equivalent_attempts)
	);
}

export function TasksPanel({
	client,
	instance,
	connected,
}: {
	client: RrdSessionClient;
	instance: string;
	connected: boolean;
}) {
	const recoveryKey = `rrd-task-recovery:${client.profile}:${instance}`;
	const assessmentRecoveryKey = `${recoveryKey}:assessment`;
	const [tasks, setTasks] = useState<TaskSummary[]>([]);
	const [selected, setSelected] = useState<TaskSummary | null>(null);
	const [page, setPage] = useState({ cursor: "0", next: "0", more: false });
	const [title, setTitle] = useState("");
	const [goal, setGoal] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [openUncertain, setOpenUncertain] = useState(false);
	const [assessmentRecovery, setAssessmentRecovery] = useState<TaskRecovery | null>(() => {
		try {
			return readTaskRecovery(assessmentRecoveryKey);
		} catch {
			return null;
		}
	});
	async function load(cursor = "0") {
		setBusy(true);
		setError("");
		try {
			const result = await client.task({ action: "list", after_cursor: cursor });
			if (result.kind !== "page") throw new Error("Unexpected task page response");
			setTasks(result.tasks);
			setPage({ cursor, next: result.next_cursor, more: result.truncated });
			setOpenUncertain(false);
		} catch (e) {
			setError(message(e));
		} finally {
			setBusy(false);
		}
	}
	async function open() {
		setBusy(true);
		setError("");
		try {
			const result = await client.task({ action: "open", title, goal });
			if (result.kind !== "task") throw new Error("Unexpected task creation response");
			setSelected(result.task);
			setTitle("");
			setGoal("");
		} catch (e) {
			setOpenUncertain(true);
			setError(
				`${message(e)}. Refresh tasks before opening again; the engine may have accepted the request.`,
			);
		} finally {
			setBusy(false);
		}
	}
	async function recover() {
		setError("");
		setBusy(true);
		try {
			const saved =
				readTaskRecovery(recoveryKey) ?? readTaskRecovery(`${recoveryKey}:assessment`);
			if (!saved) throw new Error("No last-attempt coordinates are saved for this project");
			const result = await client.task({ action: "read", task_id: saved.task_id });
			if (result.kind !== "task") throw new Error("Unexpected task readback");
			setSelected(result.task);
		} catch (e) {
			setError(message(e));
		} finally {
			setBusy(false);
		}
	}
	async function recoverAssessmentTask() {
		if (!assessmentRecovery) return;
		setError("");
		setBusy(true);
		try {
			const result = await client.task({
				action: "read",
				task_id: assessmentRecovery.task_id,
			});
			if (result.kind !== "task") throw new Error("Unexpected assessment task readback");
			setSelected(result.task);
		} catch (e) {
			setError(message(e));
		} finally {
			setBusy(false);
		}
	}
	if (!connected)
		return (
			<Alert title="Tasks require a native session">
				Connect to this project's installed engine using the desktop session above.
			</Alert>
		);
	return (
		<Stack>
			<Title order={3}>Tasks and model handoffs</Title>
			<Text>
				Record real work, review a controller's proposed handoff, then explicitly request a
				draft from the selected worker. Each call uses the engine's task budget.
			</Text>
			{error && (
				<Alert
					color="red"
					title="Task operation failed"
				>
					{error}
				</Alert>
			)}
			<Group>
				<Button
					disabled={busy}
					onClick={() => void load()}
				>
					Read tasks
				</Button>
				<Button
					variant="light"
					disabled={busy}
					onClick={() => void recover()}
				>
					Recover last attempt
				</Button>
				{assessmentRecovery && selected?.id !== assessmentRecovery.task_id && (
					<Button
						variant="light"
						disabled={busy}
						onClick={() => void recoverAssessmentTask()}
					>
						Open saved assessment task
					</Button>
				)}
				{page.more && (
					<Button
						disabled={busy}
						onClick={() => void load(page.next)}
					>
						Next task page
					</Button>
				)}
			</Group>
			{tasks.map((task) => (
				<Button
					key={task.id}
					variant={selected?.id === task.id ? "light" : "subtle"}
					onClick={() => setSelected(task)}
				>
					{task.title} · {task.status}
				</Button>
			))}
			<Paper
				withBorder
				p="md"
			>
				<Stack>
					<Title order={4}>Open a task</Title>
					<TextInput
						label="Task title"
						value={title}
						onChange={(e) => setTitle(e.currentTarget.value)}
						maxLength={256}
					/>
					<Textarea
						label="Goal, acceptance criteria and limits"
						value={goal}
						onChange={(e) => setGoal(e.currentTarget.value)}
						minRows={3}
						maxLength={4096}
					/>
					<Button
						disabled={busy || openUncertain || !title.trim() || !goal.trim()}
						onClick={() => void open()}
					>
						Record task in RRFlow
					</Button>
				</Stack>
			</Paper>
			{selected && (
				<TaskDetail
					key={`${client.profile}:${instance}:${selected.id}`}
					task={selected}
					client={client}
					instance={instance}
					recoveryKey={recoveryKey}
					assessmentRecovery={assessmentRecovery}
					onAssessmentRecoveryChange={setAssessmentRecovery}
				/>
			)}
		</Stack>
	);
}

function TaskDetail({
	task,
	client,
	instance,
	recoveryKey,
	assessmentRecovery,
	onAssessmentRecoveryChange,
}: {
	task: TaskSummary;
	client: RrdSessionClient;
	instance: string;
	recoveryKey: string;
	assessmentRecovery: TaskRecovery | null;
	onAssessmentRecoveryChange: (recovery: TaskRecovery | null) => void;
}) {
	const [budget, setBudget] = useState<TaskBudget | null>(null);
	const [budgetRead, setBudgetRead] = useState(false);
	const [prepared, setPrepared] = useState<Extract<TaskReply, { kind: "prepared" }> | null>(null);
	const [proposal, setProposal] = useState<TaskProposal | null>(null);
	const [workerReview, setWorkerReview] = useState<WorkerReview | null>(null);
	const [worker, setWorker] = useState<WorkerDraft | null>(null);
	const [sourceInventory, setSourceInventory] = useState<SourceInventory | null>(null);
	const [selectedSourceIdentity, setSelectedSourceIdentity] = useState<string | null>(null);
	const [sourceExportApproved, setSourceExportApproved] = useState(false);
	const [sourceError, setSourceError] = useState("");
	const [assessmentPrepared, setAssessmentPrepared] = useState<Extract<
		TaskReply,
		{ kind: "assessment_prepared" }
	> | null>(null);
	const [assessmentMode, setAssessmentMode] = useState("binary");
	const [assessmentProposition, setAssessmentProposition] = useState("");
	const [assessmentQuestion, setAssessmentQuestion] = useState("");
	const [assessmentOptions, setAssessmentOptions] = useState("");
	const [assessmentRubric, setAssessmentRubric] = useState("");
	const [assessmentMinimum, setAssessmentMinimum] = useState("0");
	const [assessmentMaximum, setAssessmentMaximum] = useState("1");
	const [assessmentDirection, setAssessmentDirection] = useState<
		"higher_is_better" | "lower_is_better"
	>("higher_is_better");
	const [practiceText, setPracticeText] = useState("");
	const [assessmentExportApproved, setAssessmentExportApproved] = useState(false);
	const [assessmentAttempt, setAssessmentAttempt] = useState("");
	const [assessmentOutput, setAssessmentOutput] = useState<TaskAssessmentOutput | null>(null);
	const [assessmentStatus, setAssessmentStatus] = useState("");
	const [assessmentBusy, setAssessmentBusy] = useState(false);
	const [attempt, setAttempt] = useState("");
	const [attemptStatus, setAttemptStatus] = useState("");
	const [needsReadback, setNeedsReadback] = useState(false);
	const [repeatedWorkResumeApproved, setRepeatedWorkResumeApproved] = useState(false);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [proposing, setProposing] = useState(false);
	const [reading, setReading] = useState(false);
	const [steps, setSteps] = useState("");
	const [stepMs, setStepMs] = useState("");
	const [runMs, setRunMs] = useState("");
	const sending = useRef(false);
	const workerDraftCache = useRef(new WorkerDraftCache());
	const assessmentGeneration = useRef(0);
	const readAssessmentRef = useRef<(id: string) => Promise<void>>(async () => {});
	const assessmentRecoveryKey = `${recoveryKey}:assessment`;
	const hasAssessmentRecovery = Boolean(
		assessmentRecovery || localStorage.getItem(assessmentRecoveryKey),
	);
	function invalidateAssessment() {
		assessmentGeneration.current += 1;
		setAssessmentOutput(null);
		setAssessmentExportApproved(false);
	}
	useEffect(() => {
		workerDraftCache.current.clear();
		setWorker(null);
		setWorkerReview(null);
		setSourceInventory(null);
		setSelectedSourceIdentity(null);
		setSourceExportApproved(false);
		setSourceError("");
		return () => {
			workerDraftCache.current.invalidate();
		};
	}, []);
	useEffect(
		() => () => {
			assessmentGeneration.current += 1;
		},
		[],
	);
	useEffect(() => {
		try {
			const saved = readTaskRecovery(recoveryKey);
			if (saved?.task_id === task.id) {
				setAttempt(saved.attempt_id);
				setNeedsReadback(true);
			}
		} catch (e) {
			setError(message(e));
		}
	}, [recoveryKey, task.id]);
	useEffect(() => {
		try {
			const saved = readTaskRecovery(assessmentRecoveryKey);
			if (saved?.task_id === task.id) {
				setAssessmentAttempt(saved.attempt_id);
				void readAssessmentRef.current(saved.attempt_id);
			}
		} catch (e) {
			setError(message(e));
		}
	}, [assessmentRecoveryKey, task.id]);
	async function refresh() {
		const generation = workerDraftCache.current.begin(true);
		setReading(true);
		setError("");
		setWorker(null);
		try {
			const result = await client.task({ action: "budget", task_id: task.id });
			if (result.kind !== "budget") throw new Error("Unexpected budget response");
			if (!workerDraftCache.current.isCurrent(generation)) return;
			setRepeatedWorkResumeApproved(false);
			setBudget(result.budget);
			setBudgetRead(true);
			if (attempt) {
				const read = await client.task({
					action: "attempt",
					task_id: task.id,
					attempt_id: attempt,
				});
				if (read.kind !== "attempt") throw new Error("Unexpected attempt response");
				if (!workerDraftCache.current.isCurrent(generation)) return;
				setAttemptStatus(
					read.status === "accepted" && !read.worker
						? "Attempt read; no worker output is available to this session."
						: (read.status ?? "No attempt is recorded; acceptance remains unconfirmed"),
				);
				setProposal(read.proposal);
				if (workerDraftCache.current.commit(generation, read.worker)) {
					setWorker(read.worker);
				}
				setWorkerReview(null);
				setNeedsReadback(
					!read.status ||
						read.status === "reserved" ||
						Boolean(
							result.budget?.execution_may_continue || result.budget?.active_attempt,
						),
				);
			} else {
				if (!workerDraftCache.current.isCurrent(generation)) return;
				setNeedsReadback(
					Boolean(result.budget?.execution_may_continue || result.budget?.active_attempt),
				);
			}
		} catch (e) {
			if (workerDraftCache.current.isCurrent(generation)) {
				setBudgetRead(false);
				setNeedsReadback(true);
				setWorker(null);
				if (attempt) {
					setAttemptStatus(
						"Attempt access could not be confirmed; the result may not be authorized or available.",
					);
				}
				setError(message(e));
			}
		} finally {
			if (workerDraftCache.current.isCurrent(generation)) setReading(false);
		}
	}
	async function configure() {
		setBusy(true);
		setError("");
		setWorkerReview(null);
		setSourceExportApproved(false);
		try {
			const result = await client.task({
				action: "configure",
				task_id: task.id,
				limits: {
					max_steps: positiveInteger(steps),
					max_step_elapsed_ms: positiveInteger(stepMs),
					max_run_elapsed_ms: positiveInteger(runMs),
				},
			});
			if (result.kind !== "budget") throw new Error("Unexpected budget response");
			setRepeatedWorkResumeApproved(false);
			setBudget(result.budget);
			setBudgetRead(true);
		} catch (e) {
			setBudgetRead(false);
			setError(`${message(e)}. Read the budget before another change.`);
		} finally {
			setBusy(false);
		}
	}
	async function prepare() {
		setBusy(true);
		setError("");
		setPrepared(null);
		try {
			const result = await client.task({ action: "prepare", task_id: task.id });
			if (result.kind !== "prepared") throw new Error("Unexpected preparation response");
			setPrepared(result);
		} catch (e) {
			setError(message(e));
		} finally {
			setBusy(false);
		}
	}
	async function propose() {
		if (!prepared || sending.current || needsReadback || hasAssessmentRecovery || reading)
			return;
		sending.current = true;
		setProposing(true);
		setError("");
		setProposal(null);
		setWorker(null);
		setWorkerReview(null);
		setSourceExportApproved(false);
		try {
			const id = crypto.randomUUID();
			// Persist coordinates before IPC. A storage failure prevents dispatch.
			localStorage.setItem(recoveryKey, JSON.stringify({ task_id: task.id, attempt_id: id }));
			setAttempt(id);
			setNeedsReadback(true);
			setAttemptStatus("Request pending; read back this attempt if the reply is lost");
			const result = await client.task({
				action: "propose",
				task_id: task.id,
				attempt_id: id,
				expected_task_sha256: prepared.task_sha256,
				expected_configuration_sha256: prepared.configuration_sha256,
			});
			if (result.kind === "not_dispatched") {
				setAttemptStatus(`Not dispatched: ${result.reason}`);
				setNeedsReadback(false);
				const saved = readTaskRecovery(recoveryKey);
				if (saved?.attempt_id === id) localStorage.removeItem(recoveryKey);
				setAttempt("");
				return;
			}
			if (result.kind !== "proposal") throw new Error("Unexpected proposal response");
			setProposal(result.proposal);
			setAttemptStatus("Proposal accepted; refresh the budget and attempt to reconcile");
		} catch (e) {
			setError(
				`${message(e)}. Do not retry inference automatically. Read back the recorded attempt and budget.`,
			);
		} finally {
			sending.current = false;
			setProposing(false);
			setPrepared(null);
		}
	}
	async function stop() {
		if (!budget) return;
		setBusy(true);
		setError("");
		try {
			const result = await client.task({
				action: "stop",
				task_id: task.id,
				expected_budget_sha256: budget.sha256,
			});
			if (result.kind !== "budget") throw new Error("Unexpected Stop response");
			setRepeatedWorkResumeApproved(false);
			setBudget(result.budget);
			setPrepared(null);
			setWorkerReview(null);
		} catch (e) {
			setError(`${message(e)}. Refresh the budget; Stop may need its latest digest.`);
		} finally {
			setBusy(false);
		}
	}
	async function resume() {
		if (
			!budget ||
			!budgetRead ||
			busy ||
			reading ||
			sending.current ||
			needsReadback ||
			hasAssessmentRecovery
		)
			return;
		if (budget.stopped === "repeated_work" && !repeatedWorkResumeApproved) return;
		sending.current = true;
		setBusy(true);
		setError("");
		setPrepared(null);
		setWorkerReview(null);
		setSourceExportApproved(false);
		setNeedsReadback(true);
		try {
			const result = await client.task({
				action: "resume",
				task_id: task.id,
				expected_budget_sha256: budget.sha256,
			});
			if (result.kind !== "budget" || !result.budget) {
				throw new Error("Unexpected resume response");
			}
			if (!preservesBudgetHistory(budget, result.budget)) {
				setBudgetRead(false);
				throw new Error(
					"Resume changed the original budget or repeated-work history; read it back before continuing.",
				);
			}
			setRepeatedWorkResumeApproved(false);
			setBudget(result.budget);
			setNeedsReadback(false);
		} catch (e) {
			setBudgetRead(false);
			setError(
				`${message(e)}. Resume may have completed. Read the budget before another change.`,
			);
		} finally {
			sending.current = false;
			setBusy(false);
		}
	}
	async function reviewWorker() {
		if (!proposal || needsReadback || hasAssessmentRecovery || sending.current) return;
		const generation = workerDraftCache.current.begin();
		setBusy(true);
		setError("");
		setWorkerReview(null);
		setSourceExportApproved(false);
		try {
			const selectedSource = sourceInventory?.entries.find(
				(entry) => entry.entry_identity === selectedSourceIdentity,
			);
			const source: TaskWorkerSourceRequest | null = selectedSource
				? {
						contract_version: 1,
						entry_identity: selectedSource.entry_identity,
						expected_content_sha256: selectedSource.content_sha256,
						maximum_input_bytes: Number(BigInt(selectedSource.bytes) || 1n),
					}
				: null;
			const result = await client.task({
				action: "prepare_worker",
				task_id: task.id,
				selection_attempt_id: proposal.attempt_id,
				source,
			});
			if (result.kind !== "worker_prepared")
				throw new Error("Unexpected worker review response");
			if (!workerDraftCache.current.isCurrent(generation)) return;
			if (source) {
				const reviewed = result.review.source;
				if (
					!reviewed ||
					reviewed.request.entry_identity !== source.entry_identity ||
					reviewed.request.expected_content_sha256 !== source.expected_content_sha256 ||
					reviewed.request.maximum_input_bytes !== source.maximum_input_bytes ||
					reviewed.path !== selectedSource?.path ||
					reviewed.bytes !== selectedSource?.bytes
				) {
					throw new Error("Native worker review changed the selected source fields");
				}
			}
			if (!source && result.review.source) {
				throw new Error("Native worker review added an unselected source");
			}
			setWorkerReview(result.review);
		} catch (e) {
			if (workerDraftCache.current.isCurrent(generation)) setError(message(e));
		} finally {
			if (workerDraftCache.current.isCurrent(generation)) setBusy(false);
		}
	}
	async function readSources() {
		const generation = workerDraftCache.current.begin(true);
		setSourceError("");
		setSourceInventory(null);
		setSelectedSourceIdentity(null);
		setSourceExportApproved(false);
		setWorkerReview(null);
		setWorker(null);
		try {
			const result = await client.task({ action: "sources", task_id: task.id });
			if (result.kind !== "sources") throw new Error("Unexpected source inventory response");
			if (workerDraftCache.current.isCurrent(generation))
				setSourceInventory(result.inventory);
		} catch (e) {
			if (workerDraftCache.current.isCurrent(generation)) {
				setSourceInventory(null);
				setSourceError(message(e));
			}
		}
	}
	async function prepareAssessment() {
		const generation = ++assessmentGeneration.current;
		setAssessmentBusy(true);
		setAssessmentOutput(null);
		setAssessmentPrepared(null);
		setAssessmentExportApproved(false);
		setError("");
		try {
			const current = await client.current();
			if (!current || current.instance !== instance)
				throw new Error("The current engine session changed; reconnect before assessment.");
			const catalogue = await new RrdRuntimeClient(
				current.endpoint,
				current.instance,
			).catalogue();
			if (!supportsTaskAssessmentOperations(catalogue))
				throw new Error(
					"This RRFlow version does not expose both supported task assessment operations.",
				);
			const result = await client.task({ action: "prepare_assessment", task_id: task.id });
			if (result.kind !== "assessment_prepared")
				throw new Error("Unexpected assessment preparation response");
			if (generation !== assessmentGeneration.current) return;
			setAssessmentPrepared(result);
			setSourceInventory(result.inventory);
			setSelectedSourceIdentity(null);
		} catch (e) {
			if (generation === assessmentGeneration.current) setError(message(e));
		} finally {
			if (generation === assessmentGeneration.current) setAssessmentBusy(false);
		}
	}
	async function readAssessment(id = assessmentAttempt) {
		if (!id.trim()) {
			setError("Enter the recorded assessment attempt ID before protected readback.");
			return;
		}
		const generation = ++assessmentGeneration.current;
		setAssessmentBusy(true);
		setAssessmentOutput(null);
		setAssessmentStatus("Reading the protected assessment projection under current policy…");
		try {
			const budgetResult = await client.task({ action: "budget", task_id: task.id });
			if (budgetResult.kind !== "budget")
				throw new Error("Unexpected budget response during assessment recovery");
			if (generation !== assessmentGeneration.current) return;
			setRepeatedWorkResumeApproved(false);
			setBudget(budgetResult.budget);
			setBudgetRead(true);
			const saved = readTaskRecovery(assessmentRecoveryKey);
			if (saved?.task_id === task.id && saved.attempt_id === id) {
				const attemptResult = await client.task({
					action: "attempt",
					task_id: task.id,
					attempt_id: id,
				});
				if (generation !== assessmentGeneration.current) return;
				if (attemptResult.kind !== "attempt")
					throw new Error("Unexpected assessment attempt readback");
				const terminalAttempt =
					attemptResult.status === "accepted" ||
					attemptResult.status === "stopped" ||
					attemptResult.status === "invalidated";
				const safeBudget =
					budgetResult.budget !== null &&
					!budgetResult.budget?.execution_may_continue &&
					!budgetResult.budget?.active_attempt;
				if (terminalAttempt && safeBudget) {
					const stillSaved = readTaskRecovery(assessmentRecoveryKey);
					if (stillSaved?.task_id === task.id && stillSaved.attempt_id === id) {
						localStorage.removeItem(assessmentRecoveryKey);
						onAssessmentRecoveryChange(null);
					}
				}
			}
			const remainingRecovery = readTaskRecovery(assessmentRecoveryKey);
			setNeedsReadback(
				Boolean(
					budgetResult.budget?.execution_may_continue ||
						budgetResult.budget?.active_attempt ||
						remainingRecovery,
				),
			);
			const result = await client.task({
				action: "assessment",
				task_id: task.id,
				attempt_id: id,
			});
			if (result.kind !== "assessment")
				throw new Error("Unexpected assessment read response");
			if (generation !== assessmentGeneration.current) return;
			if (
				result.assessment &&
				(result.assessment.task_id !== task.id || result.assessment.attempt_id !== id)
			)
				throw new Error(
					"Assessment readback changed the requested task or attempt identity",
				);
			setAssessmentOutput(result.assessment);
			setAssessmentStatus(
				result.assessment
					? "Protected assessment read complete."
					: "No accepted assessment is available to this session.",
			);
		} catch (e) {
			if (generation === assessmentGeneration.current) {
				setAssessmentOutput(null);
				setAssessmentStatus(
					"Protected read was denied or unavailable; no prior assessment is shown.",
				);
				setError(message(e));
			}
		} finally {
			if (generation === assessmentGeneration.current) setAssessmentBusy(false);
		}
	}
	readAssessmentRef.current = readAssessment;
	async function requestAssessment() {
		if (
			localStorage.getItem(assessmentRecoveryKey) ||
			assessmentRecovery ||
			!assessmentPrepared ||
			!budget ||
			sending.current ||
			needsReadback ||
			reading
		) {
			if (localStorage.getItem(assessmentRecoveryKey) || assessmentRecovery)
				setError("Check the saved assessment attempt before starting another request.");
			return;
		}
		sending.current = true;
		const initialGeneration = assessmentGeneration.current;
		const selected = sourceInventory?.entries.find(
			(entry) => entry.entry_identity === selectedSourceIdentity,
		);
		if (!selected) {
			sending.current = false;
			setError("Select one currently listed source file before requesting an assessment.");
			return;
		}
		if (!assessmentExportApproved) {
			sending.current = false;
			setError("Confirm source and practice export before requesting the assessment.");
			return;
		}
		if (assessmentPrepared.unavailable || !assessmentPrepared.maximum_input_bytes) {
			sending.current = false;
			setError(assessmentPrepared.unavailable ?? "Assessment policy is unavailable.");
			return;
		}
		let dispatchedAttempt = false;
		try {
			const descriptor = assessmentDescriptor(assessmentMode, {
				proposition: assessmentProposition,
				question: assessmentQuestion,
				options: assessmentOptions,
				rubric: assessmentRubric,
				minimum: assessmentMinimum,
				maximum: assessmentMaximum,
				direction: assessmentDirection,
			});
			if (assessmentMode === "binary" && !assessmentProposition.trim())
				throw new Error("Enter a proposition to assess.");
			if (
				assessmentMode === "choice" &&
				(!assessmentQuestion.trim() ||
					!("options" in descriptor) ||
					descriptor.options.length < 2)
			)
				throw new Error("Enter a question and at least two choice labels, one per line.");
			if (
				assessmentMode === "score" &&
				(!assessmentRubric.trim() ||
					!assessmentMinimum.trim() ||
					!assessmentMaximum.trim() ||
					!Number.isFinite(Number(assessmentMinimum)) ||
					!Number.isFinite(Number(assessmentMaximum)) ||
					Number(assessmentMinimum) >= Number(assessmentMaximum))
			)
				throw new Error("Enter a rubric and finite ordered score bounds.");
			const practiceBytes = new TextEncoder().encode(practiceText);
			if (!practiceText.trim() || practiceBytes.length > 65_536)
				throw new Error(
					"Practice text is required and must be at most 65,536 UTF-8 bytes.",
				);
			const policyLimit = BigInt(assessmentPrepared.maximum_input_bytes);
			const fileBytes = BigInt(selected.bytes);
			const maximumInputBytes = Number(fileBytes < policyLimit ? fileBytes : policyLimit);
			if (!Number.isSafeInteger(maximumInputBytes) || maximumInputBytes < 1)
				throw new Error("The selected source has no admissible byte range.");
			const source: TaskWorkerSourceRequest = {
				contract_version: 1,
				entry_identity: selected.entry_identity,
				expected_content_sha256: selected.content_sha256,
				maximum_input_bytes: maximumInputBytes,
			};
			if (
				initialGeneration !== assessmentGeneration.current ||
				!assessmentExportApproved ||
				selectedSourceIdentity !== selected.entry_identity
			) {
				throw new Error("Assessment inputs or export approval changed before dispatch.");
			}
			const id = crypto.randomUUID();
			localStorage.setItem(
				assessmentRecoveryKey,
				JSON.stringify({ task_id: task.id, attempt_id: id }),
			);
			onAssessmentRecoveryChange({ task_id: task.id, attempt_id: id });
			setAssessmentAttempt(id);
			setAssessmentOutput(null);
			setAssessmentStatus(
				"Assessment request pending. Read this attempt; do not repeat if the reply is lost.",
			);
			setError("");
			const generation = ++assessmentGeneration.current;
			dispatchedAttempt = true;
			setProposing(true);
			setNeedsReadback(true);
			setAssessmentBusy(true);
			const result = await client.task({
				action: "assess",
				task_id: task.id,
				attempt_id: id,
				expected_task_sha256: assessmentPrepared.task_sha256,
				expected_configuration_sha256: assessmentPrepared.configuration_sha256,
				source,
				descriptor,
				practice_text: practiceText,
			});
			if (generation !== assessmentGeneration.current) return;
			if (result.kind === "not_dispatched") {
				const saved = readTaskRecovery(assessmentRecoveryKey);
				if (saved?.task_id === task.id && saved.attempt_id === id) {
					localStorage.removeItem(assessmentRecoveryKey);
					onAssessmentRecoveryChange(null);
				}
				setAssessmentAttempt("");
				setAssessmentStatus(`Not dispatched: ${result.reason}`);
				setNeedsReadback(false);
				return;
			}
			if (result.kind !== "assessment" || !result.assessment)
				throw new Error("Unexpected assessment response");
			if (result.assessment.task_id !== task.id || result.assessment.attempt_id !== id)
				throw new Error(
					"Assessment response changed the requested task or attempt identity",
				);
			await readAssessment(id);
		} catch (e) {
			setAssessmentOutput(null);
			if (dispatchedAttempt) {
				setAssessmentStatus(
					"Outcome may be unknown. Read the recorded assessment attempt before any further call.",
				);
				setError(
					`${message(e)}. Do not dispatch this assessment again; read back its attempt.`,
				);
			} else {
				setError(message(e));
			}
		} finally {
			sending.current = false;
			setProposing(false);
			setAssessmentBusy(false);
		}
	}
	async function requestWorker() {
		if (!workerReview || sending.current || needsReadback || hasAssessmentRecovery || reading)
			return;
		if (workerReview.source && !sourceExportApproved) {
			setError("Confirm the selected source export before requesting the worker draft.");
			return;
		}
		const generation = workerDraftCache.current.begin(true);
		sending.current = true;
		setProposing(true);
		setError("");
		setWorker(null);
		try {
			const id = crypto.randomUUID();
			localStorage.setItem(recoveryKey, JSON.stringify({ task_id: task.id, attempt_id: id }));
			setAttempt(id);
			setNeedsReadback(true);
			setAttemptStatus("Worker request pending; read back this attempt if the reply is lost");
			const result = await client.task({
				action: "work",
				task_id: task.id,
				attempt_id: id,
				selection_attempt_id: workerReview.selection_attempt_id,
				expected_selection_sha256: workerReview.selection_sha256,
				expected_task_sha256: workerReview.task_sha256,
				expected_configuration_sha256: workerReview.configuration_sha256,
				source: workerReview.source?.request ?? null,
			});
			if (!workerDraftCache.current.isCurrent(generation)) return;
			if (result.kind === "not_dispatched") {
				setAttemptStatus(`Not dispatched: ${result.reason}`);
				setNeedsReadback(false);
				const saved = readTaskRecovery(recoveryKey);
				if (saved?.attempt_id === id) localStorage.removeItem(recoveryKey);
				setAttempt("");
				return;
			}
			if (result.kind !== "worker") throw new Error("Unexpected worker response");
			const expectedSource = workerReview.source?.request;
			const observedSource = result.worker.source;
			if (
				(expectedSource &&
					(!observedSource ||
						observedSource.entry_identity !== expectedSource.entry_identity ||
						observedSource.content_sha256 !==
							expectedSource.expected_content_sha256)) ||
				(!expectedSource && observedSource)
			) {
				throw new Error("Worker result source provenance differs from the reviewed source");
			}
			setWorker(result.worker);
			setAttemptStatus("Worker draft retained; read the budget and attempt to confirm state");
		} catch (e) {
			if (workerDraftCache.current.isCurrent(generation)) {
				setWorker(null);
				setError(
					`${message(e)}. Read back this worker attempt and budget before any further call.`,
				);
			}
		} finally {
			sending.current = false;
			// Refresh may supersede disclosure while the native worker request is
			// still running. A stale result cannot restore text, but it must release
			// this component's in-flight state after the call settles.
			setProposing(false);
			if (workerDraftCache.current.isCurrent(generation)) {
				setWorkerReview(null);
				setPrepared(null);
			}
		}
	}
	const selectedSource = sourceInventory?.entries.find(
		(entry) => entry.entry_identity === selectedSourceIdentity,
	);
	const assessmentBudgetAvailable = Boolean(
		budget &&
			!hasAssessmentRecovery &&
			!budget.stopped &&
			!budget.active_attempt &&
			!budget.execution_may_continue &&
			BigInt(budget.reserved_steps) < BigInt(budget.max_steps) &&
			BigInt(budget.charged_elapsed_ms) < BigInt(budget.max_run_elapsed_ms),
	);
	const canResume = Boolean(
		budget?.stopped === "cancelled" ||
			budget?.stopped === "attempt_failed" ||
			budget?.stopped === "repeated_work",
	);
	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack>
				<Title order={4}>{task.title}</Title>
				<Badge>{task.status}</Badge>
				<Text>{task.goal}</Text>
				<details>
					<summary>Task identity details</summary>
					<Code>{task.id}</Code>
					{budget?.active_attempt && <Code>Active attempt: {budget.active_attempt}</Code>}
				</details>
				{assessmentRecovery && assessmentRecovery.task_id !== task.id && (
					<Alert title="A saved assessment needs checking">
						Use Open saved assessment task to check its current engine status before
						starting another controller request.
					</Alert>
				)}
				<Group>
					<Button
						loading={reading}
						disabled={busy}
						onClick={() => void refresh()}
					>
						Read budget and attempt
					</Button>
					<Button
						color="red"
						disabled={!budget || busy || Boolean(budget.stopped)}
						onClick={() => void stop()}
					>
						Stop task budget
					</Button>
					<Button
						disabled={
							!budgetRead ||
							!budget ||
							busy ||
							reading ||
							proposing ||
							needsReadback ||
							hasAssessmentRecovery ||
							task.status !== "open" ||
							Boolean(budget.active_attempt) ||
							budget.execution_may_continue ||
							!canResume ||
							(budget.stopped === "repeated_work" && !repeatedWorkResumeApproved)
						}
						onClick={() => void resume()}
					>
						Resume task budget
					</Button>
				</Group>
				{budget?.stopped === "repeated_work" && (
					<Checkbox
						checked={repeatedWorkResumeApproved}
						disabled={
							busy ||
							reading ||
							needsReadback ||
							Boolean(budget.active_attempt) ||
							budget.execution_may_continue
						}
						onChange={(event) =>
							setRepeatedWorkResumeApproved(event.currentTarget.checked)
						}
						label="I reviewed this repeated-work stop. Resume does not reset the original deadline, effort or repetition history; unchanged work may be stopped again before dispatch."
					/>
				)}
				<Text
					size="sm"
					c="dimmed"
				>
					Resume keeps the original deadline and spent effort. It does not run a model.
					Review current inputs before requesting new work.
				</Text>
				{error && (
					<Alert
						color="red"
						title="Controller operation"
					>
						{error}
					</Alert>
				)}
				{budget ? (
					<>
						<Text>
							{budget.reserved_steps} / {budget.max_steps} steps reserved ·{" "}
							{budget.charged_elapsed_ms} ms charged ·{" "}
							{budget.stopped ?? "No persisted stop"}
						</Text>
						{budget.active_attempt && (
							<Text>Active attempt: {budget.active_attempt}</Text>
						)}
						<Text size="sm">
							Original deadline:{" "}
							{new Date(Number(budget.deadline_unix_ms)).toLocaleString()}
						</Text>
						{budget.execution_may_continue && (
							<Alert color="orange">
								Remote execution may continue. Stop prevents acceptance; it does not
								prove GPU work ended.
							</Alert>
						)}
						{(budget.repetition_policy ||
							Object.keys(budget.equivalent_attempts).length > 0) && (
							<details>
								<summary>Repeated-work history</summary>
								<Text size="sm">
									Equivalent-work limit:{" "}
									{budget.repetition_policy?.max_equivalent_attempts ??
										"not configured"}
								</Text>
								<Code block>
									{JSON.stringify(budget.equivalent_attempts, null, 2)}
								</Code>
							</details>
						)}
					</>
				) : (
					<>
						<Text>
							{budgetRead
								? "No task budget is configured."
								: "Read the engine budget before configuring limits."}
						</Text>
						<Group grow>
							<TextInput
								label="Maximum steps"
								value={steps}
								onChange={(e) => setSteps(e.currentTarget.value)}
							/>
							<TextInput
								label="Maximum step time (ms)"
								value={stepMs}
								onChange={(e) => setStepMs(e.currentTarget.value)}
							/>
							<TextInput
								label="Maximum run time (ms)"
								value={runMs}
								onChange={(e) => setRunMs(e.currentTarget.value)}
							/>
						</Group>
						<Button
							disabled={
								!budgetRead || busy || proposing || !steps || !stepMs || !runMs
							}
							onClick={() => void configure()}
						>
							Configure task budget
						</Button>
					</>
				)}
				<Paper
					withBorder
					p="md"
				>
					<Stack>
						<Title order={4}>Assess a source file</Title>
						<Text size="sm">
							Choose one assessment and a source file under the current task budget.
							Results are advisory, not correctness verdicts.
						</Text>
						<Button
							variant="light"
							loading={assessmentBusy && !assessmentPrepared}
							disabled={busy || proposing || reading || needsReadback}
							onClick={() => void prepareAssessment()}
						>
							Review current policy and source files
						</Button>
						{assessmentPrepared && (
							<>
								<Text>
									Destination:{" "}
									{assessmentPrepared.controller_destination ?? "Unavailable"} ·
									Policy:{" "}
									{assessmentPrepared.allow_network
										? "network on"
										: "network off"}
									,{" "}
									{assessmentPrepared.allow_source_export
										? "source export on"
										: "source export off"}
									,{" "}
									{assessmentPrepared.allow_context_export
										? "context export on"
										: "context export off"}
								</Text>
								{assessmentPrepared.maximum_input_bytes && (
									<Text>
										Maximum input: {assessmentPrepared.maximum_input_bytes}{" "}
										bytes · Maximum response:{" "}
										{assessmentPrepared.maximum_response_bytes} bytes · Request
										window:{" "}
										{assessmentPrepared.wait_timeout_ms ?? "unavailable"} ms
									</Text>
								)}
								<details>
									<summary>Assessment provenance details</summary>
									<Code
										block
									>{`Controller binding: ${assessmentPrepared.controller_binding_id ?? "unavailable"}\nTask digest: ${assessmentPrepared.task_sha256}\nConfiguration digest: ${assessmentPrepared.configuration_sha256}\nDeclaration: caller-authored ad hoc input; not an imported SWAG template`}</Code>
								</details>
								{assessmentPrepared.unavailable && (
									<Alert color="orange">
										{assessmentPrepared.unavailable} The assessment stays
										unavailable; no alternate operation is attempted.
									</Alert>
								)}
								{assessmentPrepared.inventory && (
									<>
										<Text size="sm">
											RRFlow checks current source eligibility and export
											permission before dispatch.
										</Text>
										<Select
											label="Source file"
											placeholder="Choose one source file"
											data={assessmentPrepared.inventory.entries.map(
												(entry) => ({
													value: entry.entry_identity,
													label: `${entry.path} · ${entry.bytes} bytes`,
												}),
											)}
											value={selectedSourceIdentity}
											allowDeselect={false}
											searchable
											disabled={
												busy || proposing || reading || assessmentBusy
											}
											onChange={(value) => {
												workerDraftCache.current.clear();
												invalidateAssessment();
												setSelectedSourceIdentity(value);
												setSourceExportApproved(false);
												setAssessmentExportApproved(false);
												setWorkerReview(null);
												setWorker(null);
											}}
										/>
										{(assessmentPrepared.inventory.truncated ||
											assessmentPrepared.inventory.incomplete_rows > 0 ||
											assessmentPrepared.inventory.unavailable_rows > 0 ||
											assessmentPrepared.inventory.oversized_rows > 0) && (
											<Alert
												color="orange"
												title="Inventory view is incomplete"
											>
												{assessmentPrepared.inventory.truncated &&
													"The query was truncated or reached its row cap. "}
												{assessmentPrepared.inventory.incomplete_rows > 0 &&
													`${assessmentPrepared.inventory.incomplete_rows} malformed rows were omitted. `}
												{assessmentPrepared.inventory.unavailable_rows >
													0 &&
													`${assessmentPrepared.inventory.unavailable_rows} rows lacked typed source metadata and remain unselectable. `}
												{assessmentPrepared.inventory.oversized_rows > 0 &&
													`${assessmentPrepared.inventory.oversized_rows} files exceeded the request cap. `}
											</Alert>
										)}
										{selectedSource && (
											<Text size="sm">
												Selected: {selectedSource.path} ·{" "}
												{selectedSource.bytes} bytes
											</Text>
										)}
										{selectedSource && (
											<details>
												<summary>Source identity details</summary>
												<Code
													block
												>{`Entry identity: ${selectedSource.entry_identity}\nContent SHA-256: ${selectedSource.content_sha256}\nRead cursor: ${assessmentPrepared.inventory?.read_cursor ?? "unavailable"}\nRead manifest: ${assessmentPrepared.inventory?.read_manifest_sha256 ?? "unavailable"}`}</Code>
											</details>
										)}
									</>
								)}
								<Select
									label="Assessment mode"
									data={[
										{ value: "binary", label: "Binary" },
										{ value: "score", label: "Score" },
										{ value: "choice", label: "Choice" },
									]}
									value={assessmentMode}
									disabled={assessmentBusy}
									onChange={(value) => {
										invalidateAssessment();
										setAssessmentMode(value ?? "binary");
									}}
								/>
								{assessmentMode === "binary" && (
									<TextInput
										label="Yes/no statement"
										value={assessmentProposition}
										maxLength={4096}
										disabled={assessmentBusy}
										onChange={(event) => {
											invalidateAssessment();
											setAssessmentProposition(event.currentTarget.value);
										}}
									/>
								)}
								{assessmentMode === "choice" && (
									<>
										<TextInput
											label="Choice question"
											value={assessmentQuestion}
											maxLength={4096}
											disabled={assessmentBusy}
											onChange={(event) => {
												invalidateAssessment();
												setAssessmentQuestion(event.currentTarget.value);
											}}
										/>
										<Textarea
											label="Choices, one per line"
											value={assessmentOptions}
											maxLength={16_000}
											disabled={assessmentBusy}
											onChange={(event) => {
												invalidateAssessment();
												setAssessmentOptions(event.currentTarget.value);
											}}
											minRows={3}
										/>
									</>
								)}
								{assessmentMode === "score" && (
									<>
										<Textarea
											label="Scoring criteria"
											value={assessmentRubric}
											maxLength={4096}
											disabled={assessmentBusy}
											onChange={(event) => {
												invalidateAssessment();
												setAssessmentRubric(event.currentTarget.value);
											}}
											minRows={3}
										/>
										<Group grow>
											<TextInput
												type="number"
												label="Minimum"
												value={assessmentMinimum}
												disabled={assessmentBusy}
												onChange={(event) => {
													invalidateAssessment();
													setAssessmentMinimum(event.currentTarget.value);
												}}
											/>
											<TextInput
												type="number"
												label="Maximum"
												value={assessmentMaximum}
												disabled={assessmentBusy}
												onChange={(event) => {
													invalidateAssessment();
													setAssessmentMaximum(event.currentTarget.value);
												}}
											/>
											<Select
												label="Direction"
												data={[
													{
														value: "higher_is_better",
														label: "Higher is better",
													},
													{
														value: "lower_is_better",
														label: "Lower is better",
													},
												]}
												value={assessmentDirection}
												disabled={assessmentBusy}
												onChange={(value) => {
													invalidateAssessment();
													setAssessmentDirection(
														value === "lower_is_better"
															? value
															: "higher_is_better",
													);
												}}
											/>
										</Group>
									</>
								)}
								<Textarea
									label="Guidance or development practice"
									value={practiceText}
									maxLength={65_536}
									disabled={assessmentBusy}
									onChange={(event) => {
										invalidateAssessment();
										setPracticeText(event.currentTarget.value);
									}}
									minRows={4}
								/>
								<Checkbox
									checked={assessmentExportApproved}
									disabled={assessmentBusy || busy || proposing || reading}
									onChange={(event) =>
										setAssessmentExportApproved(event.currentTarget.checked)
									}
									label="I approve sending this source and practice text to the configured controller under the current export policy."
								/>
								<Button
									loading={assessmentBusy && Boolean(assessmentAttempt)}
									disabled={
										!assessmentBudgetAvailable ||
										!assessmentPrepared.inventory ||
										Boolean(assessmentPrepared.unavailable) ||
										!selectedSource ||
										!assessmentExportApproved ||
										busy ||
										proposing ||
										reading ||
										needsReadback ||
										assessmentBusy
									}
									onClick={() => void requestAssessment()}
								>
									Request assessment
								</Button>
							</>
						)}
						{assessmentAttempt && (
							<Button
								variant="light"
								disabled={assessmentBusy}
								onClick={() => void readAssessment()}
							>
								Check assessment result
							</Button>
						)}
						<details>
							<summary>Optional recovery by attempt ID</summary>
							<TextInput
								label="Assessment attempt ID"
								value={assessmentAttempt}
								disabled={assessmentBusy}
								onChange={(event) => {
									invalidateAssessment();
									setAssessmentAttempt(event.currentTarget.value);
									setAssessmentStatus("");
								}}
							/>
							<Button
								variant="light"
								disabled={assessmentBusy || !assessmentAttempt.trim()}
								onClick={() => void readAssessment()}
							>
								Check this attempt
							</Button>
						</details>
						{assessmentStatus && <Text role="status">{assessmentStatus}</Text>}
						{assessmentOutput && (
							<Paper
								withBorder
								p="sm"
							>
								<Stack gap="xs">
									<Title order={5}>Advisory assessment report</Title>
									<Text>Result: {assessmentOutcomeText(assessmentOutput)}</Text>
									<Text size="sm">
										Advisory result; it does not determine correctness.
									</Text>
									<details>
										<summary>Evidence and provenance</summary>
										<Code
											block
										>{`Attempt: ${assessmentOutput.attempt_id}\nEndpoint alias: ${assessmentOutput.service_id}\nController binding: ${assessmentOutput.controller_binding_id}\nTask digest: ${assessmentOutput.task_sha256}\nConfiguration digest: ${assessmentOutput.configuration_sha256}\nRequest digest: ${assessmentOutput.request_sha256}\nResponse digest: ${assessmentOutput.response_sha256}\nPractice text SHA-256: ${assessmentOutput.practice_sha256}\nSource SHA-256: ${assessmentOutput.source.content_sha256}\nCaller-declared assessment identity: ${assessmentOutput.practice_identity.template_id}@${assessmentOutput.practice_identity.template_revision}\nDeclaration SHA-256: ${assessmentOutput.practice_identity.template_sha256}`}</Code>
										<Text>Input byte references</Text>
										{assessmentOutput.references.map((reference, index) => (
											<Text
												key={`${reference.input}-${reference.start_byte}-${reference.end_byte}-${index}`}
											>
												{reference.input}: bytes {reference.start_byte}–
												{reference.end_byte}; SHA-256{" "}
												{reference.input_sha256}
											</Text>
										))}
									</details>
								</Stack>
							</Paper>
						)}
					</Stack>
				</Paper>
				<Button
					variant="light"
					disabled={busy || proposing || task.status !== "open"}
					onClick={() => void prepare()}
				>
					Review controller inputs
				</Button>
				{prepared && (
					<>
						<Text>Controller: {prepared.controller ?? "Not configured"}</Text>
						<Text>
							Configured candidates: {prepared.candidates.join(", ") || "None"}
						</Text>
						<Text>Task: {prepared.task.title}</Text>
						<Text>{prepared.task.goal}</Text>
						<Code
							block
						>{`Task digest: ${prepared.task_sha256}\nConfiguration digest: ${prepared.configuration_sha256}`}</Code>
						{prepared.unavailable ? (
							<Alert color="orange">{prepared.unavailable}</Alert>
						) : (
							<Text>
								Native request timeout: {prepared.wait_timeout_ms} ms. Requesting
								sends this task to the configured controller under the engine
								policy.
							</Text>
						)}
						<Button
							disabled={
								Boolean(prepared.unavailable) ||
								!budget ||
								Boolean(
									budget.stopped ||
										budget.active_attempt ||
										budget.execution_may_continue,
								) ||
								busy ||
								proposing ||
								reading ||
								needsReadback
							}
							onClick={() => void propose()}
						>
							Request one experimental proposal
						</Button>
					</>
				)}
				{proposing && (
					<Text role="status">
						Waiting for the engine. Budget reads and Stop remain available.
					</Text>
				)}
				<TextInput
					label="Attempt ID for readback"
					value={attempt}
					disabled={proposing || reading}
					onChange={(e) => {
						setAttempt(e.currentTarget.value);
						setProposal(null);
						setWorker(null);
						setWorkerReview(null);
						setAttemptStatus("");
						setNeedsReadback(true);
					}}
				/>
				{attemptStatus && <Text role="status">{attemptStatus}</Text>}
				{needsReadback && (
					<Text>
						Readback is required before another model call. Missing output is not
						permission to repeat inference.
					</Text>
				)}
				{proposal && (
					<Paper
						withBorder
						p="sm"
					>
						<Stack gap="xs">
							<Text fw={650}>
								{proposal.choice.kind === "select"
									? `Proposed binding: ${proposal.choice.binding_id}`
									: `Controller abstained: ${proposal.choice.reason}`}
							</Text>
							{proposal.choice.kind === "select" && (
								<Text>Effort: {proposal.choice.effort ?? "Provider default"}</Text>
							)}
							<Text>
								Observed service alias: {proposal.service_id} · Elapsed:{" "}
								{proposal.elapsed_ms ?? "unknown"} ms
							</Text>
							<Code
								block
							>{`Attempt: ${proposal.attempt_id}\nTask: ${proposal.task_sha256}\nConfiguration: ${proposal.configuration_sha256}\nResponse: ${proposal.response_sha256}`}</Code>
							<Text size="sm">
								This receipt records a proposal. It does not prove worker execution,
								model quality or reviewed training consent.
							</Text>
							{proposal.choice.kind === "select" && (
								<Stack gap="xs">
									<Button
										variant="light"
										disabled={
											busy ||
											proposing ||
											reading ||
											needsReadback ||
											hasAssessmentRecovery
										}
										onClick={() => void readSources()}
									>
										Read project source inventory
									</Button>
									{sourceError && (
										<Alert
											color="orange"
											title="Project source unavailable"
										>
											{sourceError}. No source was selected. Older inventory
											schemas may not publish this typed field.
										</Alert>
									)}
									{sourceInventory && (
										<>
											<Text size="sm">
												Stored inventory observation at read cursor{" "}
												{sourceInventory.read_cursor}. it does not
												authenticate the current accepted head, current
												file, or export permission.
											</Text>
											<Code
												block
											>{`Read manifest: ${sourceInventory.read_manifest_sha256}\nIdentity version: ${sourceInventory.result_identity_version}`}</Code>
											<Select
												label="Optional project file"
												placeholder="No project source"
												data={[
													{ value: "", label: "No project source" },
													...sourceInventory.entries.map(
														(entry: SourceCandidate) => ({
															value: entry.entry_identity,
															label: `${entry.path} · ${entry.bytes} bytes`,
														}),
													),
												]}
												value={selectedSourceIdentity ?? ""}
												allowDeselect={false}
												searchable
												disabled={busy || proposing || reading}
												onChange={(value) => {
													workerDraftCache.current.clear();
													setSelectedSourceIdentity(value || null);
													setSourceExportApproved(false);
													setWorkerReview(null);
													setWorker(null);
												}}
											/>
											{(sourceInventory.truncated ||
												sourceInventory.incomplete_rows > 0 ||
												sourceInventory.unavailable_rows > 0 ||
												sourceInventory.oversized_rows > 0) && (
												<Alert
													color="orange"
													title="Inventory view is incomplete"
												>
													{sourceInventory.truncated &&
														"The query was truncated or reached its row cap; more entries may exist. "}
													{sourceInventory.incomplete_rows > 0 &&
														`${sourceInventory.incomplete_rows} malformed rows were omitted. `}
													{sourceInventory.unavailable_rows > 0 &&
														`${sourceInventory.unavailable_rows} rows lacked typed source metadata and were left unselectable; they may be older-schema, redacted, or non-file records. `}
													{sourceInventory.oversized_rows > 0 &&
														`${sourceInventory.oversized_rows} files exceed the route request cap and were omitted. `}
													A shown file remains subject to the engine's
													current dispatch checks.
												</Alert>
											)}
										</>
									)}
									{selectedSource && (
										<Code
											block
										>{`Selected path: ${selectedSource.path}\nEntry identity: ${selectedSource.entry_identity}\nContent SHA-256: ${selectedSource.content_sha256}\nObserved bytes: ${selectedSource.bytes}`}</Code>
									)}
									<Button
										disabled={
											busy ||
											proposing ||
											reading ||
											needsReadback ||
											hasAssessmentRecovery
										}
										onClick={() => void reviewWorker()}
									>
										Review worker and selected source
									</Button>
								</Stack>
							)}
						</Stack>
					</Paper>
				)}
				{workerReview && (
					<Paper
						withBorder
						p="sm"
					>
						<Stack gap="xs">
							<Text fw={650}>Selected worker: {workerReview.binding_id}</Text>
							<Text>
								Effort: {workerReview.effort ?? "Configured provider default"}
							</Text>
							<Text>
								This sends the task text for one draft under the current worker
								policy. The selected source is sent only when shown in this review.
								Files are not changed.
							</Text>
							{workerReview.source && (
								<>
									<Text>
										Selected file: {workerReview.source.path}. The request is
										capped at {workerReview.source.request.maximum_input_bytes}{" "}
										bytes; the observed file contains{" "}
										{workerReview.source.bytes} bytes.
									</Text>
									<Text size="sm">
										This typed inventory read is a stored observation at cursor{" "}
										{workerReview.source.read_cursor}, not a claim about
										current-head membership or permission. RRFlow rechecks
										current eligibility at dispatch.
									</Text>
									<Checkbox
										checked={sourceExportApproved}
										disabled={busy || proposing || reading}
										onChange={(event) =>
											setSourceExportApproved(event.currentTarget.checked)
										}
										label="I approve sending this selected file as worker context under the current RRFlow source-export policy."
									/>
									<Code
										block
									>{`Entry: ${workerReview.source.request.entry_identity}\nContent SHA-256: ${workerReview.source.request.expected_content_sha256}\nQuery read manifest: ${workerReview.source.read_manifest_sha256}\nQuery identity version: ${workerReview.source.result_identity_version}`}</Code>
								</>
							)}
							<Code
								block
							>{`Selection: ${workerReview.selection_attempt_id}\nTask: ${workerReview.task_sha256}\nConfiguration: ${workerReview.configuration_sha256}`}</Code>
							<Button
								disabled={
									busy ||
									proposing ||
									reading ||
									needsReadback ||
									hasAssessmentRecovery ||
									!budget ||
									Boolean(
										budget.stopped ||
											budget.active_attempt ||
											budget.execution_may_continue,
									) ||
									Boolean(workerReview.source && !sourceExportApproved)
								}
								onClick={() => void requestWorker()}
							>
								Request worker draft
							</Button>
						</Stack>
					</Paper>
				)}
				{worker && (
					<Paper
						withBorder
						p="sm"
					>
						<Stack gap="xs">
							<Title order={5}>Worker draft</Title>
							<Text>
								Retained by RRFlow for review. This does not mark the task complete
								or authorize training.
							</Text>
							<Text>
								Binding: {worker.binding_id} · Observed service: {worker.service_id}
							</Text>
							<Code
								block
								style={{ maxHeight: 420, overflow: "auto", whiteSpace: "pre-wrap" }}
							>
								{worker.content}
							</Code>
							<Code
								block
							>{`Attempt: ${worker.attempt_id}\nSelection: ${worker.selection_attempt_id}\nContent: ${worker.content_sha256}\nResponse: ${worker.response_sha256}`}</Code>
							{worker.source && (
								<>
									<Text size="sm">
										Source provenance reports engine capture and completion
										validation. The policy digest is historical snapshot
										metadata, not current path authorization.
									</Text>
									<Code block>{JSON.stringify(worker.source, null, 2)}</Code>
								</>
							)}
						</Stack>
					</Paper>
				)}
			</Stack>
		</Paper>
	);
}
