import {
	Alert,
	Button,
	Checkbox,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { adapter } from "~/adapter";
import { JSON_FILTER } from "~/constants";
import { newId } from "~/shared/util/helpers";
import type { ConnectionWorkbenchState } from "~/types";
import {
	benchmarkWorkloadProfiles,
	buildDatasetArtifacts,
	type DatasetBuildArtifact,
} from "./workbenchDataset";
import { normalizeWorkbenchState } from "./workbenchState";

export function WorkbenchDatasetPlans({ state }: { state: ConnectionWorkbenchState | undefined }) {
	const profile = useMemo(() => normalizeWorkbenchState(state, newId), [state]);
	const [templateId, setTemplateId] = useState<string | null>(null);
	const [workloadId, setWorkloadId] = useState(benchmarkWorkloadProfiles[0].id);
	const [runLabel, setRunLabel] = useState("");
	const [telemetryProfile, setTelemetryProfile] = useState("real-world-baseline");
	const [hops, setHops] = useState(true);
	const [actions, setActions] = useState(true);
	const [tools, setTools] = useState(true);
	const [time, setTime] = useState(true);
	const [artifacts, setArtifacts] = useState<DatasetBuildArtifact[]>([]);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState<string | null>(null);
	const template = profile.templates.find((entry) => entry.id === templateId);
	const workload = benchmarkWorkloadProfiles.find((entry) => entry.id === workloadId);

	const generate = () => {
		if (!template || !workload) {
			setError("Select an available template and workload profile.");
			return;
		}
		setArtifacts(
			buildDatasetArtifacts({
				template,
				runLabel: runLabel.trim() || `dataset-run-${Date.now()}`,
				workloadProfile: workload,
				remoteSources: profile.remoteSources ?? [],
				telemetry: { profile: telemetryProfile, hops, actions, tools, time },
			}),
		);
		setError(null);
		setMessage("Plan generated locally. Save each file explicitly; no workload has run.");
	};

	const save = async (artifact: DatasetBuildArtifact) => {
		setSaving(artifact.fileName);
		setError(null);
		setMessage(null);
		try {
			const requested = await adapter.saveFile(
				"Save dataset plan file",
				artifact.fileName,
				[JSON_FILTER],
				() => artifact.content,
			);
			setMessage(
				requested
					? `Save requested for ${artifact.fileName}.`
					: `Save cancelled for ${artifact.fileName}.`,
			);
		} catch (cause) {
			if (cause instanceof DOMException && cause.name === "AbortError") {
				setMessage(`Save cancelled for ${artifact.fileName}.`);
			} else {
				setError(
					`Could not save ${artifact.fileName}: ${cause instanceof Error ? cause.message : String(cause)}`,
				);
			}
		} finally {
			setSaving(null);
		}
	};

	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack>
				<Title order={4}>Dataset and comparison plans</Title>
				<Text size="sm">
					Generate six local planning files from a saved template. This does not index a
					project, run a workload, or compare engines.
				</Text>
				<Alert title="Review before sharing">
					The manifest includes configured remote source URLs and template details. Linked
					folder synchronization and cloud access are not available here.
				</Alert>
				<Select
					label="Template"
					placeholder="Select a saved template"
					value={templateId}
					data={profile.templates.map((entry) => ({
						value: entry.id,
						label: entry.name,
					}))}
					onChange={setTemplateId}
				/>
				{profile.templates.length === 0 && (
					<Text size="sm">No saved templates are available in this profile.</Text>
				)}
				<Select
					label="Workload profile"
					value={workloadId}
					data={benchmarkWorkloadProfiles.map((entry) => ({
						value: entry.id,
						label: entry.label,
					}))}
					allowDeselect={false}
					onChange={(value) => {
						if (value) setWorkloadId(value);
					}}
				/>
				{workload && (
					<Text size="xs">
						{workload.description} Target: {workload.minimumPromptCount} prompts,{" "}
						{workload.targetLatencyMs} ms.{" "}
						{workload.requiresRemoteSource &&
							"Remote source availability is unverified."}
					</Text>
				)}
				<TextInput
					label="Run label"
					value={runLabel}
					onChange={(event) => setRunLabel(event.currentTarget.value)}
				/>
				<TextInput
					label="Telemetry profile"
					value={telemetryProfile}
					onChange={(event) => setTelemetryProfile(event.currentTarget.value)}
				/>
				<Group>
					<Checkbox
						label="Hops"
						checked={hops}
						onChange={(event) => setHops(event.currentTarget.checked)}
					/>
					<Checkbox
						label="Actions"
						checked={actions}
						onChange={(event) => setActions(event.currentTarget.checked)}
					/>
					<Checkbox
						label="Tools"
						checked={tools}
						onChange={(event) => setTools(event.currentTarget.checked)}
					/>
					<Checkbox
						label="Time"
						checked={time}
						onChange={(event) => setTime(event.currentTarget.checked)}
					/>
				</Group>
				<Button
					disabled={!template || !workload}
					onClick={generate}
				>
					Generate plan files
				</Button>
				{error && (
					<Alert
						color="red"
						title="Dataset plan error"
					>
						{error}
					</Alert>
				)}
				{message && <Text size="sm">{message}</Text>}
				{artifacts.length > 0 && (
					<Text size="sm">
						These files are a snapshot of the inputs at generation time. Generate again
						to include subsequent changes.
					</Text>
				)}
				{artifacts.map((artifact) => (
					<Paper
						key={artifact.fileName}
						withBorder
						p="xs"
					>
						<Group justify="space-between">
							<Text size="sm">{artifact.fileName}</Text>
							<Button
								variant="light"
								size="xs"
								disabled={saving !== null}
								loading={saving === artifact.fileName}
								onClick={() => void save(artifact)}
							>
								Save file
							</Button>
						</Group>
						<details>
							<summary>Preview generated file</summary>
							<Text
								component="pre"
								size="xs"
								style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
							>
								{artifact.content}
							</Text>
						</details>
					</Paper>
				))}
			</Stack>
		</Paper>
	);
}
