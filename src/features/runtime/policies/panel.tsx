import { Alert, Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import type { ConfigurationReply, PreparedPolicy, Settings } from "~/rrflow/configuration";
import { currentSettings } from "~/rrflow/configuration";
import type { RrdSessionClient } from "~/rrflow/session";
import { EffectiveValues, PolicyDetails, PolicyRules } from "./rules";

type Snapshot = Extract<ConfigurationReply, { kind: "snapshot" }>;

export function PolicyPanel({
	client,
	connected,
	recoveryKey,
}: {
	client: RrdSessionClient;
	connected: boolean;
	recoveryKey: string;
}) {
	const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
	const [settings, setSettings] = useState<Settings>({});
	const [prepared, setPrepared] = useState<PreparedPolicy | null>(null);
	const [recovery, setRecovery] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	async function run(action: () => Promise<void>) {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			await action();
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	}
	function clearRecovery() {
		localStorage.removeItem(recoveryKey);
		setRecovery(null);
	}
	async function refresh() {
		const result = await client.configuration({ action: "read" });
		if (result.kind !== "snapshot") throw new Error("Unexpected policy read response");
		setSnapshot(result);
		setSettings(currentSettings(result.project));
		const digest = localStorage.getItem(recoveryKey);
		if (digest && result.project.head?.applied_plan_sha256 === digest) {
			clearRecovery();
			setPrepared(null);
			setNotice("Stored policy confirms that the original approval was committed.");
		}
	}
	useEffect(() => {
		let active = true;
		async function load() {
			setBusy(true);
			try {
				const digest = localStorage.getItem(recoveryKey);
				const pending = connected
					? await client.configuration({ action: "pending" })
					: null;
				if (!active) return;
				if (digest && !/^[a-f0-9]{64}$/.test(digest))
					throw new Error(
						"Stored policy recovery digest is invalid; preserve it for inspection.",
					);
				setRecovery(digest);
				if (pending?.kind === "pending") setPrepared(pending.prepared);
				setReady(true);
			} catch (error) {
				if (active) setError(error instanceof Error ? error.message : String(error));
			} finally {
				if (active) setBusy(false);
			}
		}
		void load();
		return () => {
			active = false;
		};
	}, [client, connected, recoveryKey]);
	async function preview() {
		if (!snapshot) return;
		// A failed preparation invalidates the previous native preview too.
		setPrepared(null);
		const result = await client.configuration({
			action: "prepare",
			expected_revision: snapshot.project.head?.revision ?? "0",
			settings,
		});
		if (result.kind !== "prepared") throw new Error("Unexpected policy preview response");
		setPrepared(result);
	}
	async function approve() {
		if (!prepared) return;
		localStorage.setItem(recoveryKey, prepared.plan.plan_sha256);
		setRecovery(prepared.plan.plan_sha256);
		const result = await client.configuration({ action: "approve", handle: prepared.handle });
		if (result.kind === "uncertain") {
			setPrepared({ ...prepared, uncertain: true });
			throw new Error(
				`${result.message}. Outcome unknown. Refresh stored policy or retry this same approval.`,
			);
		}
		if (result.kind === "denied") {
			clearRecovery();
			setPrepared(null);
			throw new Error(result.message);
		}
		if (result.kind !== "applied")
			throw new Error(
				"Unexpected approval response; inspect stored policy before another change",
			);
		clearRecovery();
		setPrepared(null);
		await refresh();
		setNotice(
			`Engine committed project policy revision ${result.project.head?.revision}. The read below is a separate current observation. Run a query to inspect its actual admission stamp.`,
		);
	}
	const disabled = busy || !connected || !ready;
	const effective = snapshot?.effective;
	const drift =
		effective &&
		snapshot &&
		effective.project_read_revision !== (snapshot.project.head?.revision ?? "0");
	return (
		<Stack>
			<Group justify="space-between">
				<div>
					<Title order={3}>Policies and preferences</Title>
					<Text c="dimmed">
						Control how much work this project can do and inspect the requirements it
						inherits.
					</Text>
				</div>
				<Badge color={connected ? "green" : "gray"}>
					{connected ? "Connected to project" : "Disconnected"}
				</Badge>
			</Group>
			{!connected && (
				<Alert>Connect to this project's engine to read or change its policies.</Alert>
			)}
			{error && (
				<Alert
					color="red"
					title="Policy request needs attention"
				>
					{error}
				</Alert>
			)}
			{notice && <Alert color="blue">{notice}</Alert>}
			<Group>
				<Button
					disabled={disabled}
					onClick={() => void run(refresh)}
				>
					Read current policies
				</Button>
				<Text size="sm">Refresh replaces unsaved form edits. It never writes policy.</Text>
			</Group>
			{recovery && (
				<Alert
					color="yellow"
					title="Approval outcome needs confirmation"
				>
					<Stack gap="xs">
						<Text>
							Refresh stored policy to check the original approval. If another edit
							has superseded it, this view cannot establish its earlier outcome;
							retain the digest for history inspection.
						</Text>
						<PolicyDetails
							value={{ plan_sha256: recovery }}
							label="Original approval digest"
						/>
					</Stack>
				</Alert>
			)}
			{snapshot && (
				<>
					<Paper
						withBorder
						p="md"
					>
						<Stack gap="sm">
							<Title order={4}>User policies and preferences</Title>
							{effective ? (
								<Text>
									{effective.user_revision
										? `Bound user source: ${effective.user_revision.source_id}. Selected revision ${effective.user_revision.revision}; read through revision ${effective.user_read_revision}. User requirements constrain this project. Manage shared policy through the user configuration CLI.`
										: "This project has no bound user policy source. It uses project rules and installation limits. Binding a source is an explicit installation choice."}
								</Text>
							) : (
								<Text>
									The engine could not resolve effective policies. No claim about
									the current user binding can be made from this read.
								</Text>
							)}
							{effective?.user_revision && (
								<PolicyDetails
									value={effective.user_revision}
									label="User policy evidence"
								/>
							)}
						</Stack>
					</Paper>
					<Paper
						withBorder
						p="md"
					>
						<Stack>
							<Title order={4}>Project rules</Title>
							<Text>
								Latest recorded revision:{" "}
								{snapshot.project.head?.revision ?? "0 (installation settings)"}.
								Minimum and maximum are requirements. A preferred amount is used
								within the combined bounds. Blank fields inherit other scopes.
							</Text>
							<Text size="sm">
								A preview proposes this full set of numeric rules from now onward.
								Existing recorded history is preserved. If a scheduled rule exists,
								inspect its time interval below before replacing it.
							</Text>
							<PolicyRules
								settings={settings}
								onChange={(value) => {
									setSettings(value);
									setPrepared(null);
								}}
								disabled={disabled || Boolean(recovery) || Boolean(prepared)}
							/>
							<Group>
								<Button
									disabled={disabled || Boolean(recovery) || Boolean(prepared)}
									onClick={() => void run(preview)}
								>
									Preview project changes
								</Button>
							</Group>
							<PolicyDetails
								value={snapshot.project}
								label="Recorded project policy and installation identity"
							/>
						</Stack>
					</Paper>
					{snapshot.effective_error && (
						<Alert
							color="red"
							title="Effective policy could not be resolved"
						>
							{snapshot.effective_error} Project rules remain editable so you can
							repair a conflict.
						</Alert>
					)}
					{drift && (
						<Alert color="yellow">
							Policy changed between these separate reads. Refresh before preparing
							another change.
						</Alert>
					)}
					{effective && (
						<Paper
							withBorder
							p="md"
						>
							<Stack>
								<Title order={4}>Effective values for the next request</Title>
								<Text size="sm">
									Observed at {effective.valid_at_unix_ms} (Unix milliseconds).
									Project policy {effective.project_policy?.revision ?? "0"}, read
									through {effective.project_read_revision}. Each operation checks
									policy again when admitted.
								</Text>
								<EffectiveValues values={effective.values} />
							</Stack>
						</Paper>
					)}
				</>
			)}
			{prepared && (
				<Paper
					withBorder
					p="md"
				>
					<Stack>
						<Title order={4}>Review project changes</Title>
						<Text>
							Applies to {prepared.plan.current.identity.instance_id}, after revision{" "}
							{prepared.plan.current.head?.revision ?? "0"}. Valid from{" "}
							{prepared.plan.change.valid_from_unix_ms}; preview expires at{" "}
							{prepared.plan.expires_at_unix_ms} (Unix milliseconds).
						</Text>
						<Text>
							These are the engine's projected values. Approval sends the exact
							native-held plan; it cannot edit the user policy source.
						</Text>
						<EffectiveValues values={prepared.plan.values} />
						<PolicyDetails
							value={prepared.plan}
							label="Exact plan, proposed rules and digests"
						/>
						<Group>
							<Button
								disabled={disabled}
								onClick={() => void run(approve)}
							>
								{recovery || prepared.uncertain
									? "Retry same approval"
									: "Approve project changes"}
							</Button>
							<Button
								variant="subtle"
								disabled={disabled || Boolean(recovery) || prepared.uncertain}
								onClick={() =>
									void run(async () => {
										await client.configuration({
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
