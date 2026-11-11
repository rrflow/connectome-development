import {
	Alert,
	Badge,
	Button,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import type { WorkbenchDatasetTemplate } from "~/types";
import type { BenchmarkWorkloadProfile, DatasetBuildResult } from "./dataset";

interface DatasetLaneReadiness {
	id: string;
	label: string;
	ready: boolean;
}

export function WorkbenchDatasetPanel({
	templates,
	selectedDatasetTemplateId,
	onSelectTemplate,
	workloadProfiles,
	selectedWorkloadProfile,
	onSelectWorkloadProfile,
	datasetBuildRunLabel,
	onChangeRunLabel,
	datasetOutputFolderOptions,
	datasetBuildFolderLinkId,
	onSelectOutputFolder,
	datasetFlowReadiness,
	datasetBuildError,
	onGenerateDatasetFiles,
	datasetBuildResults,
	formatWhen,
	datasetCompareReadiness,
	latestDatasetBuildResult,
	onRefreshSnapshot,
	canRefreshSnapshot,
	onPrepareCompareFlight,
	onRecordCompareReceipt,
	canRecordCompareReceipt,
}: {
	templates: WorkbenchDatasetTemplate[];
	selectedDatasetTemplateId: string | null;
	onSelectTemplate: (id: string | null) => void;
	workloadProfiles: BenchmarkWorkloadProfile[];
	selectedWorkloadProfile: BenchmarkWorkloadProfile;
	onSelectWorkloadProfile: (id: string | null) => void;
	datasetBuildRunLabel: string;
	onChangeRunLabel: (label: string) => void;
	datasetOutputFolderOptions: { value: string; label: string }[];
	datasetBuildFolderLinkId: string | null;
	onSelectOutputFolder: (id: string | null) => void;
	datasetFlowReadiness: DatasetLaneReadiness[];
	datasetBuildError: string | null;
	onGenerateDatasetFiles: () => void;
	datasetBuildResults: DatasetBuildResult[];
	formatWhen: (unixMs?: number) => string;
	datasetCompareReadiness: DatasetLaneReadiness[];
	latestDatasetBuildResult: DatasetBuildResult | null;
	onRefreshSnapshot: () => void;
	canRefreshSnapshot: boolean;
	onPrepareCompareFlight: () => void;
	onRecordCompareReceipt: () => void;
	canRecordCompareReceipt: boolean;
}) {
	return (
		<Paper
			withBorder
			p="lg"
		>
			<Stack>
				<Title order={4}>Dataset build recipes and file generation</Title>
				<Text size="sm">
					Generate real Workbench dataset files from template schema, skills, and research
					references. Write directly to a linked folder or download.
				</Text>
				<Group grow>
					<Select
						label="Template"
						value={selectedDatasetTemplateId}
						data={templates.map((template) => ({
							value: template.id,
							label: template.name,
						}))}
						placeholder="Select template"
						onChange={onSelectTemplate}
					/>
					<Select
						label="Workload profile"
						value={selectedWorkloadProfile.id}
						data={workloadProfiles.map((profile) => ({
							value: profile.id,
							label: profile.label,
						}))}
						onChange={onSelectWorkloadProfile}
					/>
					<TextInput
						label="Run label"
						placeholder="real-world-comparator-run"
						value={datasetBuildRunLabel}
						onChange={(event) => onChangeRunLabel(event.currentTarget.value)}
					/>
					<Select
						label="Output linked folder (optional)"
						value={datasetBuildFolderLinkId}
						data={datasetOutputFolderOptions}
						placeholder="Download only"
						onChange={onSelectOutputFolder}
					/>
				</Group>
				<Text size="xs">
					{selectedWorkloadProfile.description} · prompts≥
					{selectedWorkloadProfile.minimumPromptCount} · target latency≤
					{selectedWorkloadProfile.targetLatencyMs}ms
					{selectedWorkloadProfile.requiresRemoteSource ? " · requires cloud source" : ""}
				</Text>
				<Group gap="xs">
					{datasetFlowReadiness.map((check) => (
						<Badge
							key={check.id}
							color={check.ready ? "green" : "orange"}
							variant="light"
						>
							{check.label}: {check.ready ? "ready" : "missing"}
						</Badge>
					))}
				</Group>
				{datasetBuildError && (
					<Alert
						color="red"
						title="Dataset build failed"
					>
						{datasetBuildError}
					</Alert>
				)}
				<Group justify="flex-end">
					<Button
						variant="light"
						onClick={onGenerateDatasetFiles}
						disabled={!selectedDatasetTemplateId}
					>
						Generate dataset files
					</Button>
				</Group>
				{datasetBuildResults.length > 0 && (
					<Stack gap="xs">
						<Title order={5}>Build results</Title>
						{datasetBuildResults.map((result) => (
							<Paper
								key={result.id}
								withBorder
								p="xs"
							>
								<Group justify="space-between">
									<Text size="sm">
										{result.templateName} · {result.workloadProfileLabel} ·{" "}
										{result.runLabel}
									</Text>
									<Badge variant="light">
										{result.outputMode === "linked-folder"
											? "linked folder"
											: "download"}
									</Badge>
								</Group>
								<Text
									size="xs"
									c="slate"
								>
									{formatWhen(result.createdAtUnixMs)} · artifacts=
									{result.artifactCount}
									{result.outputPath ? ` · ${result.outputPath}` : ""}
								</Text>
							</Paper>
						))}
					</Stack>
				)}
				<Paper
					withBorder
					p="sm"
				>
					<Stack gap="xs">
						<Title order={5}>Run + inspect + compare</Title>
						<Text size="xs">
							Prepare a governed compare flight from the latest bundle, refresh the
							engine snapshot, then record a comparison receipt.
						</Text>
						<Group gap="xs">
							{datasetCompareReadiness.map((check) => (
								<Badge
									key={check.id}
									color={check.ready ? "green" : "orange"}
									variant="light"
								>
									{check.label}: {check.ready ? "ready" : "missing"}
								</Badge>
							))}
						</Group>
						{latestDatasetBuildResult && (
							<Text size="xs">
								Latest bundle: {latestDatasetBuildResult.templateName} ·{" "}
								{latestDatasetBuildResult.workloadProfileLabel} ·{" "}
								{latestDatasetBuildResult.runLabel}
							</Text>
						)}
						<Group justify="flex-end">
							<Button
								size="xs"
								variant="light"
								onClick={onRefreshSnapshot}
								disabled={!canRefreshSnapshot}
							>
								Refresh snapshot
							</Button>
							<Button
								size="xs"
								variant="light"
								onClick={onPrepareCompareFlight}
								disabled={!latestDatasetBuildResult}
							>
								Prepare compare flight
							</Button>
							<Button
								size="xs"
								variant="subtle"
								onClick={onRecordCompareReceipt}
								disabled={!canRecordCompareReceipt}
							>
								Record compare receipt
							</Button>
						</Group>
					</Stack>
				</Paper>
			</Stack>
		</Paper>
	);
}
