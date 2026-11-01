import {
	Alert,
	Badge,
	Button,
	Code,
	Group,
	Paper,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { RrdSessionClient } from "~/rrflow/session";
import {
	readTaskRecovery,
	type TaskBudget,
	type TaskProposal,
	type TaskReply,
	type TaskSummary,
} from "~/rrflow/tasks";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const positiveInteger = (value: string) => {
	const number = Number(value);
	if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number <= 0)
		throw new Error("Budget fields must be positive whole numbers");
	return number;
};

export function TasksPanel({
	client,
	instance,
	connected,
}: {
	client: RrdSessionClient;
	instance: string;
	connected: boolean;
}) {
	const [tasks, setTasks] = useState<TaskSummary[]>([]);
	const [selected, setSelected] = useState<TaskSummary | null>(null);
	const [page, setPage] = useState({ cursor: "0", next: "0", more: false });
	const [title, setTitle] = useState("");
	const [goal, setGoal] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [openUncertain, setOpenUncertain] = useState(false);
	const recoveryKey = `rrd-task-recovery:${client.profile}:${instance}`;
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
			const saved = readTaskRecovery(recoveryKey);
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
	if (!connected)
		return (
			<Alert title="Tasks require a native session">
				Connect to this project's installed engine using the desktop session above.
			</Alert>
		);
	return (
		<Stack>
			<Title order={3}>Tasks and controller proposals</Title>
			<Text>
				Record real work and inspect a configured controller's proposed handoff. Proposals
				do not execute a worker or authorize training.
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
					key={selected.id}
					task={selected}
					client={client}
					recoveryKey={recoveryKey}
				/>
			)}
		</Stack>
	);
}

function TaskDetail({
	task,
	client,
	recoveryKey,
}: {
	task: TaskSummary;
	client: RrdSessionClient;
	recoveryKey: string;
}) {
	const [budget, setBudget] = useState<TaskBudget | null>(null);
	const [budgetRead, setBudgetRead] = useState(false);
	const [prepared, setPrepared] = useState<Extract<TaskReply, { kind: "prepared" }> | null>(null);
	const [proposal, setProposal] = useState<TaskProposal | null>(null);
	const [attempt, setAttempt] = useState("");
	const [attemptStatus, setAttemptStatus] = useState("");
	const [needsReadback, setNeedsReadback] = useState(false);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [proposing, setProposing] = useState(false);
	const [reading, setReading] = useState(false);
	const [steps, setSteps] = useState("");
	const [stepMs, setStepMs] = useState("");
	const [runMs, setRunMs] = useState("");
	const sending = useRef(false);
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
	async function refresh() {
		setReading(true);
		setError("");
		try {
			const result = await client.task({ action: "budget", task_id: task.id });
			if (result.kind !== "budget") throw new Error("Unexpected budget response");
			setBudget(result.budget);
			setBudgetRead(true);
			if (attempt) {
				const read = await client.task({
					action: "attempt",
					task_id: task.id,
					attempt_id: attempt,
				});
				if (read.kind !== "attempt") throw new Error("Unexpected attempt response");
				setAttemptStatus(
					read.status ?? "No attempt is recorded; acceptance remains unconfirmed",
				);
				setProposal(read.proposal);
				setNeedsReadback(
					!read.status ||
						read.status === "reserved" ||
						Boolean(
							result.budget?.execution_may_continue || result.budget?.active_attempt,
						),
				);
			}
		} catch (e) {
			setError(message(e));
		} finally {
			setReading(false);
		}
	}
	async function configure() {
		setBusy(true);
		setError("");
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
		if (!prepared || sending.current || needsReadback) return;
		sending.current = true;
		setProposing(true);
		setError("");
		setProposal(null);
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
			setBudget(result.budget);
			setPrepared(null);
		} catch (e) {
			setError(`${message(e)}. Refresh the budget; Stop may need its latest digest.`);
		} finally {
			setBusy(false);
		}
	}
	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack>
				<Title order={4}>{task.title}</Title>
				<Badge>{task.status}</Badge>
				<Text>{task.goal}</Text>
				<Code>{task.id}</Code>
				<Group>
					<Button
						loading={reading}
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
				</Group>
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
						{budget.execution_may_continue && (
							<Alert color="orange">
								Remote execution may continue. Stop prevents acceptance; it does not
								prove GPU work ended.
							</Alert>
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
						setAttemptStatus("");
						setNeedsReadback(true);
					}}
				/>
				{attemptStatus && <Text role="status">{attemptStatus}</Text>}
				{needsReadback && (
					<Text>
						Readback is required before another proposal. Missing output is not
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
						</Stack>
					</Paper>
				)}
			</Stack>
		</Paper>
	);
}
