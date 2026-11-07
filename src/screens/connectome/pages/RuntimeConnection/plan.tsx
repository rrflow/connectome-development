import {
	Alert,
	Badge,
	Button,
	Code,
	Group,
	Paper,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import {
	type Control,
	type PlanPage,
	type PlanRecovery,
	type PlanSnapshot,
	type PreparedPlan,
	readPlanRecovery,
} from "~/rrflow/attunement";
import type { RrdSessionClient } from "~/rrflow/session";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function PlanDetails({ plan }: { plan: PlanSnapshot["plan"] }) {
	return (
		<Stack gap="xs">
			<Text size="sm">Plan {plan.id}</Text>
			<Text size="sm">
				Source digest: <Code>{plan.source_sha256}</Code>
			</Text>
			<Text size="sm">
				Plan digest: <Code>{plan.plan_sha256}</Code>
			</Text>
			<Table captionSide="top">
				<Table.Caption>Engine-provided phase order and estimates</Table.Caption>
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Order</Table.Th>
						<Table.Th>Phase</Table.Th>
						<Table.Th>Estimated items</Table.Th>
						<Table.Th>Input bytes</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{plan.phases.map((phase) => (
						<Table.Tr key={phase.sequence}>
							<Table.Td>{phase.sequence}</Table.Td>
							<Table.Td>{phase.phase}</Table.Td>
							<Table.Td>{phase.estimated_items}</Table.Td>
							<Table.Td>{phase.estimated_input_bytes}</Table.Td>
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Stack>
	);
}

export function ProjectPlanPanel({
	client,
	instance,
	connected,
}: {
	client: RrdSessionClient;
	instance: string;
	connected: boolean;
}) {
	const [page, setPage] = useState<PlanPage | null>(null);
	const [stored, setStored] = useState<PlanSnapshot | null>(null);
	const [prepared, setPrepared] = useState<PreparedPlan | null>(null);
	const [recovery, setRecovery] = useState<PlanRecovery | null>(null);
	const [leaseMs, setLeaseMs] = useState("");
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [recoveryInvalid, setRecoveryInvalid] = useState(false);
	const [recoveryReady, setRecoveryReady] = useState(false);
	const inFlight = useRef(false);
	const recoveryKey = `rrd-plan-recovery:${client.profile}:${instance}`;
	async function run(work: () => Promise<void>) {
		if (inFlight.current) return;
		inFlight.current = true;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			await work();
		} catch (e) {
			setError(message(e));
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
	}
	async function load(after: string | null = null) {
		const result = await client.attunement({ action: "list", after_job_id: after });
		if (result.kind !== "page") throw new Error("Unexpected job discovery response");
		setPage(result.page);
	}
	async function read(job_id: string) {
		const result = await client.attunement({ action: "read", job_id });
		if (result.kind !== "snapshot") throw new Error("Unexpected stored plan response");
		setStored(result.snapshot);
	}
	useEffect(() => {
		let cancelled = false;
		setRecoveryReady(false);
		let saved: PlanRecovery | null;
		try {
			saved = readPlanRecovery(recoveryKey);
			setRecovery(saved);
			setRecoveryInvalid(false);
		} catch (e) {
			setRecoveryInvalid(true);
			setError(message(e));
			return;
		}
		if (connected) {
			void client
				.attunement({ action: "pending" })
				.then((result) => {
					if (cancelled) return;
					if (result.kind !== "pending")
						throw new Error("Unexpected pending command response");
					const preview = result.prepared;
					if (
						saved &&
						preview &&
						(saved.job_id !== preview.job_id ||
							saved.idempotency_key !== preview.idempotency_key ||
							saved.replan !== preview.replan)
					) {
						throw new Error(
							"Native pending command differs from the retained recovery coordinates; preserve both for inspection",
						);
					}
					setPrepared(preview);
					setRecoveryReady(true);
				})
				.catch((e) => {
					if (!cancelled) {
						setRecoveryInvalid(true);
						setError(message(e));
					}
				});
		}
		return () => {
			cancelled = true;
		};
	}, [client, connected, recoveryKey]);
	async function prepare(command: Control) {
		if (!stored) return;
		setPrepared(null);
		const result = await client.attunement({
			action: "prepare",
			job_id: stored.status.job.id,
			expected_revision: stored.status.job.revision,
			plan_sha256: stored.plan.plan_sha256,
			command,
		});
		if (result.kind !== "prepared") throw new Error("Unexpected preparation response");
		setPrepared(result);
	}
	function clearRecovery() {
		localStorage.removeItem(recoveryKey);
		setRecovery(null);
	}
	async function approve() {
		if (!prepared) return;
		const coordinates = {
			job_id: prepared.job_id,
			idempotency_key: prepared.idempotency_key,
			replan: prepared.replan,
		};
		// Persist before dispatch. A storage failure prevents the mutation.
		localStorage.setItem(recoveryKey, JSON.stringify(coordinates));
		setRecovery(coordinates);
		const result = await client.attunement({ action: "approve", handle: prepared.handle });
		if (result.kind === "uncertain") {
			setError(
				`${result.message}. Outcome unknown. Read the receipt or explicitly retry this same approval.`,
			);
			return;
		}
		if (result.kind === "denied") {
			clearRecovery();
			setPrepared(null);
			throw new Error(result.message);
		}
		if (result.kind !== "applied")
			throw new Error(
				"Unexpected approval response; read the receipt before further changes",
			);
		setStored(result.snapshot);
		setPrepared(null);
		clearRecovery();
		setNotice(
			"The engine accepted this command. Refresh jobs to see its current lineage; this response does not verify current source.",
		);
	}
	async function receipt() {
		if (!recovery) return;
		const result = await client.attunement({ action: "receipt", ...recovery });
		if (result.kind !== "receipt") throw new Error("Unexpected receipt response");
		if (!result.snapshot) {
			setNotice(
				"No committed receipt was found for this request. That does not prove the command was rejected. Keep these recovery coordinates.",
			);
			return;
		}
		setStored(result.snapshot);
		setPrepared(null);
		clearRecovery();
		setNotice(
			"Recovered the original committed outcome without resending the command. Refresh the job for its latest state.",
		);
	}
	const disabled = busy || !connected;
	const cannotPrepare =
		disabled || !recoveryReady || Boolean(recovery) || recoveryInvalid || !stored;
	const job = stored?.status.job;
	const replan = prepared?.command.kind === "replan" ? prepared.command.request.preview : null;
	return (
		<Stack>
			<Title order={3}>Project plan</Title>
			<Text>
				Discover the installed engine's plans, inspect progress and review a successor after
				editing source files.
			</Text>
			<Alert color="blue">
				Stored reads do not check current source. Preview a replan to compare the engine's
				current source observation with this plan. Acceptance checks source again; a
				changing tree may require a fresh preview.
			</Alert>
			{!connected && <Text>Connect to the project engine to read its plans.</Text>}
			{error && (
				<Alert
					color="red"
					title="Project plan request"
				>
					{error}
				</Alert>
			)}
			{notice && <Alert color="blue">{notice}</Alert>}
			<Group>
				<Button
					disabled={disabled}
					onClick={() => void run(() => load())}
				>
					Discover jobs
				</Button>
				{page?.next_after_job_id && (
					<Button
						disabled={disabled}
						onClick={() => void run(() => load(page.next_after_job_id))}
					>
						Next job page
					</Button>
				)}
			</Group>
			{page && (
				<Paper
					withBorder
					p="md"
				>
					<Stack gap="xs">
						<Text size="sm">
							Stored observations at {page.observed_at_unix_ms}; each page is a
							separate read. Current source: {page.source_verification}.
						</Text>
						{page.jobs.map((item) => (
							<Group key={item.job_id}>
								<Button
									variant="subtle"
									disabled={disabled}
									onClick={() => void run(() => read(item.job_id))}
								>
									{item.job_id}
								</Button>
								<Badge>{item.state}</Badge>
								<Text size="sm">
									Generation {item.generation}; revision {item.revision};{" "}
									{item.checkpoint_count} checkpoints
								</Text>
							</Group>
						))}
					</Stack>
				</Paper>
			)}
			{recovery && (
				<Alert
					color="yellow"
					title="Pending outcome reconciliation"
				>
					<Stack gap="xs">
						<Text>
							Job {recovery.job_id}; request {recovery.idempotency_key}. Recovery
							reads do not dispatch work.
						</Text>
						<Button
							disabled={disabled}
							onClick={() => void run(receipt)}
						>
							Read command receipt
						</Button>
					</Stack>
				</Alert>
			)}
			{stored && job && (
				<Paper
					withBorder
					p="md"
				>
					<Stack>
						<Group>
							<Title order={4}>Stored job</Title>
							<Badge>{job.state}</Badge>
							<Button
								variant="subtle"
								disabled={disabled}
								onClick={() => void run(() => read(job.id))}
							>
								Refresh stored job
							</Button>
						</Group>
						<Text>
							{job.id} · revision {job.revision} · {job.checkpoints.length}{" "}
							checkpoints
						</Text>
						{job.current_phase && <Text>Current phase: {job.current_phase}</Text>}
						{job.lease && (
							<Text size="sm">
								Lease generation {job.lease.generation}; expires at{" "}
								{job.lease.expires_at_unix_ms} (Unix ms).
							</Text>
						)}
						{job.failure && (
							<Alert color="yellow">
								{job.failure.code}: {job.failure.message}
							</Alert>
						)}
						<PlanDetails plan={stored.plan} />
						<Button
							disabled={cannotPrepare}
							onClick={() => void run(() => prepare({ kind: "replan" }))}
						>
							Preview source replan
						</Button>
						<Text size="sm">
							Commands advance only when explicitly approved. Available phases and
							transitions are enforced by the engine; a listed phase does not
							establish implementation or project completion.
						</Text>
						<TextInput
							label="Requested lease duration (milliseconds)"
							value={leaseMs}
							onChange={(event) => setLeaseMs(event.currentTarget.value)}
							description="Required for Start or Resume; the engine enforces its configured limits."
						/>
						<Group>
							<Button
								disabled={cannotPrepare || !leaseMs}
								onClick={() =>
									void run(() => prepare({ kind: "start", lease_ms: leaseMs }))
								}
							>
								Prepare start
							</Button>
							<Button
								disabled={cannotPrepare}
								onClick={() => void run(() => prepare({ kind: "step" }))}
							>
								Prepare next step
							</Button>
							<Button
								disabled={cannotPrepare}
								onClick={() => void run(() => prepare({ kind: "pause" }))}
							>
								Prepare pause
							</Button>
							<Button
								disabled={cannotPrepare || !leaseMs}
								onClick={() =>
									void run(() => prepare({ kind: "resume", lease_ms: leaseMs }))
								}
							>
								Prepare resume
							</Button>
							<Button
								disabled={cannotPrepare}
								onClick={() => void run(() => prepare({ kind: "recover_expired" }))}
							>
								Prepare expired-lease recovery
							</Button>
						</Group>
						<TextInput
							label="Cancellation reason"
							value={reason}
							onChange={(event) => setReason(event.currentTarget.value)}
						/>
						<Button
							color="red"
							disabled={cannotPrepare || !reason.trim()}
							onClick={() => void run(() => prepare({ kind: "cancel", reason }))}
						>
							Prepare cancellation request
						</Button>
					</Stack>
				</Paper>
			)}
			{prepared && (
				<Paper
					withBorder
					p="md"
				>
					<Stack>
						<Title order={4}>Review {prepared.command.kind.replaceAll("_", " ")}</Title>
						<Text>
							Applies to {prepared.job_id}, revision{" "}
							{prepared.snapshot.status.job.revision}. Approval sends the exact
							command retained by the native client.
						</Text>
						{replan && (
							<>
								<Alert
									color={
										replan.plan.source_sha256 ===
										prepared.snapshot.plan.source_sha256
											? "blue"
											: "yellow"
									}
								>
									{replan.plan.source_sha256 ===
									prepared.snapshot.plan.source_sha256
										? "The observed source digest is unchanged."
										: "The observed source digest differs from the stored plan."}{" "}
									Accepting creates a successor and fences the predecessor. It
									does not execute the successor.
								</Alert>
								<PlanDetails plan={replan.plan} />
							</>
						)}
						<details>
							<summary>Exact engine command</summary>
							<Text size="sm">Receipt request key</Text>
							<Code block>{prepared.idempotency_key}</Code>
							<Code block>{JSON.stringify(prepared.command, null, 2)}</Code>
						</details>
						<Group>
							<Button
								disabled={disabled || !recoveryReady || recoveryInvalid}
								onClick={() => void run(approve)}
							>
								{recovery ? "Retry same approval" : "Approve command"}
							</Button>
							<Button
								variant="subtle"
								disabled={disabled || Boolean(recovery)}
								onClick={() =>
									void run(async () => {
										await client.attunement({
											action: "discard",
											handle: prepared.handle,
										});
										setPrepared(null);
									})
								}
							>
								Discard preview
							</Button>
						</Group>
					</Stack>
				</Paper>
			)}
		</Stack>
	);
}
