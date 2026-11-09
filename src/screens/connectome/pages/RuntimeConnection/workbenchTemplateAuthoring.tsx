import { Alert, Stack } from "@mantine/core";
import { useState } from "react";
import { newId } from "~/shared/util/helpers";
import { useConfigStore } from "~/shell/stores/config";
import type {
	WorkbenchLearningAction,
	WorkbenchLearningActionName,
	WorkbenchLearningEvent,
	WorkbenchLearningEventKind,
	WorkbenchLearningEventMode,
	WorkbenchLearningTrigger,
	WorkbenchLearningTriggerKind,
	WorkbenchTemplateStep,
} from "~/types";
import { normalizeWorkbenchState } from "./workbenchState";
import { WorkbenchTemplateAuthoringPanel } from "./workbenchTemplateAuthoringPanel";

const routeOptions = [
	{ value: "knowledge/models", label: "Knowledge · Models" },
	{ value: "knowledge/records", label: "Knowledge · Records" },
	{ value: "knowledge/vectors", label: "Knowledge · Vectors" },
	{ value: "system/storage", label: "System · Storage" },
	{ value: "reasoning/workbench", label: "Workbench" },
];
const kindOptions: { value: WorkbenchLearningEventKind; label: string }[] = [
	{ value: "did-you-know", label: "Did You Know" },
	{ value: "knowledge-drop", label: "Knowledge Drop" },
	{ value: "factoid", label: "Factoid" },
];
const modeOptions: { value: WorkbenchLearningEventMode; label: string }[] = [
	{ value: "passive", label: "Passive" },
	{ value: "interactive", label: "Interactive" },
];
const actionOptions: { value: WorkbenchLearningActionName; label: string }[] = [
	{ value: "navigate-route", label: "Navigate route" },
	{ value: "refresh-storage-signals", label: "Refresh storage signals" },
	{ value: "refresh-governed-flights", label: "Refresh governed flights" },
	{ value: "open-workbench", label: "Open Workbench" },
	{ value: "capture-runtime-receipt", label: "Capture runtime receipt" },
];
const triggerOptions: { value: WorkbenchLearningTriggerKind; label: string }[] = [
	{ value: "manual", label: "Manual only" },
	{ value: "cold-signal", label: "Cold signal detected" },
	{ value: "linked-path-missing", label: "Linked path missing/disconnected" },
	{ value: "governed-flights-available", label: "Governed flights available" },
];
const lines = (text: string) =>
	text
		.split(/\r?\n/)
		.map((value) => value.trim())
		.filter(Boolean);

export function WorkbenchTemplateAuthoring({ connectionId }: { connectionId: string }) {
	const connection = useConfigStore((state) =>
		state.connections.find((item) => item.id === connectionId),
	);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [schema, setSchema] = useState("");
	const [skills, setSkills] = useState("");
	const [references, setReferences] = useState("");
	const [requirements, setRequirements] = useState("");
	const [files, setFiles] = useState("");
	const [folders, setFolders] = useState("");
	const [steps, setSteps] = useState<WorkbenchTemplateStep[]>(() =>
		Array.from({ length: 3 }, (_, index) => ({
			id: newId(),
			title: `Step ${index + 1}`,
			detail: "",
			route: "reasoning/workbench",
		})),
	);
	const [events, setEvents] = useState<WorkbenchLearningEvent[]>([]);
	const [kind, setKind] = useState<WorkbenchLearningEventKind>("did-you-know");
	const [mode, setMode] = useState<WorkbenchLearningEventMode>("passive");
	const [component, setComponent] = useState<"card" | "alert" | "badge">("card");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [route, setRoute] = useState("reasoning/workbench");
	const [signoff, setSignoff] = useState(true);
	const [note, setNote] = useState("");
	const [actionName, setActionName] = useState<WorkbenchLearningActionName>("navigate-route");
	const [actionLabel, setActionLabel] = useState("");
	const [actionPayload, setActionPayload] = useState("");
	const [actions, setActions] = useState<WorkbenchLearningAction[]>([]);
	const [triggerKind, setTriggerKind] = useState<WorkbenchLearningTriggerKind>("manual");
	const [triggerDescription, setTriggerDescription] = useState("");
	const [triggers, setTriggers] = useState<WorkbenchLearningTrigger[]>(() => [
		{ id: newId(), kind: "manual", description: "Run on operator command." },
	]);
	const [error, setError] = useState<string | null>(null);

	const save = () => {
		const store = useConfigStore.getState();
		const currentConnection = store.connections.find((item) => item.id === connectionId);
		if (!currentConnection) {
			setError("Project profile is no longer available.");
			return;
		}
		if (!name.trim()) {
			setError("Template name is required.");
			return;
		}
		const current = normalizeWorkbenchState(currentConnection.workbench, newId);
		const now = Date.now();
		store.updateConnection({
			id: connectionId,
			workbench: {
				...current,
				templates: [
					{
						id: newId(),
						name: name.trim(),
						description: description.trim(),
						schema: schema.trim(),
						skills: lines(skills),
						researchReferences: lines(references),
						minimumRequirements: lines(requirements),
						filePatterns: lines(files),
						folderPatterns: lines(folders),
						createdAtUnixMs: now,
						updatedAtUnixMs: now,
						steps: steps.map((step, index) => ({
							...step,
							title: step.title.trim() || `Step ${index + 1}`,
							detail: step.detail.trim(),
						})),
						learningEvents: events,
					},
					...current.templates,
				],
			},
		});
		setName("");
		setDescription("");
		setSchema("");
		setSkills("");
		setReferences("");
		setRequirements("");
		setFiles("");
		setFolders("");
		setSteps([]);
		setEvents([]);
		setError(null);
	};

	return (
		<Stack>
			{error && (
				<Alert
					color="red"
					title="Template could not be saved"
				>
					{error}
				</Alert>
			)}
			<WorkbenchTemplateAuthoringPanel
				connectionAvailable={Boolean(connection)}
				templateName={name}
				onChangeTemplateName={setName}
				templateDescription={description}
				onChangeTemplateDescription={setDescription}
				templateSchema={schema}
				onChangeTemplateSchema={setSchema}
				templateSkills={skills}
				onChangeTemplateSkills={setSkills}
				templateResearchReferences={references}
				onChangeTemplateResearchReferences={setReferences}
				templateRequirements={requirements}
				onChangeTemplateRequirements={setRequirements}
				templateFilePatterns={files}
				onChangeTemplateFilePatterns={setFiles}
				templateFolderPatterns={folders}
				onChangeTemplateFolderPatterns={setFolders}
				learningKind={kind}
				learningKindOptions={kindOptions}
				onChangeLearningKind={(value) => {
					if (value) setKind(value);
				}}
				learningMode={mode}
				learningModeOptions={modeOptions}
				onChangeLearningMode={(value) => {
					if (value) setMode(value);
				}}
				learningComponent={component}
				onChangeLearningComponent={(value) => {
					if (value) setComponent(value);
				}}
				learningTitle={title}
				onChangeLearningTitle={setTitle}
				learningBody={body}
				onChangeLearningBody={setBody}
				learningRoute={route}
				workbenchRouteOptions={routeOptions}
				onChangeLearningRoute={(value) => {
					if (value) setRoute(value);
				}}
				learningRequiresSignoff={signoff}
				onChangeLearningRequiresSignoff={(value) => setSignoff(value !== "no")}
				learningCatamorphismNote={note}
				onChangeLearningCatamorphismNote={setNote}
				learningActionName={actionName}
				learningActionOptions={actionOptions}
				onChangeLearningActionName={(value) => {
					if (value) setActionName(value);
				}}
				learningActionLabel={actionLabel}
				onChangeLearningActionLabel={setActionLabel}
				learningActionPayload={actionPayload}
				onChangeLearningActionPayload={setActionPayload}
				learningActions={actions}
				onAddLearningAction={() => {
					setActions((current) => [
						...current,
						{
							id: newId(),
							name: actionName,
							label: actionLabel.trim() || "Action",
							payload: actionPayload.trim() || undefined,
						},
					]);
					setActionLabel("");
					setActionPayload("");
				}}
				onRemoveLearningAction={(id) =>
					setActions((current) => current.filter((entry) => entry.id !== id))
				}
				learningTriggerKind={triggerKind}
				learningTriggerOptions={triggerOptions}
				onChangeLearningTriggerKind={(value) => {
					if (value) setTriggerKind(value);
				}}
				learningTriggerDescription={triggerDescription}
				onChangeLearningTriggerDescription={setTriggerDescription}
				learningTriggers={triggers}
				onAddLearningTrigger={() => {
					setTriggers((current) => [
						...current,
						{ id: newId(), kind: triggerKind, description: triggerDescription.trim() },
					]);
					setTriggerDescription("");
				}}
				onRemoveLearningTrigger={(id) =>
					setTriggers((current) => current.filter((entry) => entry.id !== id))
				}
				templateLearningEvents={events}
				onAddLearningEvent={() => {
					if (!title.trim()) return;
					setEvents((current) => [
						...current,
						{
							id: newId(),
							kind,
							mode,
							title: title.trim(),
							body: body.trim(),
							component,
							route: mode === "interactive" ? route : undefined,
							requiresOperatorSignoff: signoff,
							triggers: triggers.length
								? triggers
								: [
										{
											id: newId(),
											kind: "manual",
											description: "Run on operator command.",
										},
									],
							actions: actions.length
								? actions
								: [
										{
											id: newId(),
											name: "navigate-route",
											label: "Open event route",
											payload: route,
										},
									],
							catamorphismTarget: "clyffy",
							catamorphismNote: note.trim(),
						},
					]);
					setTitle("");
					setBody("");
					setNote("");
					setActions([]);
					setTriggers([
						{ id: newId(), kind: "manual", description: "Run on operator command." },
					]);
				}}
				onRemoveLearningEvent={(id) =>
					setEvents((current) => current.filter((entry) => entry.id !== id))
				}
				templateStepCount={String(steps.length)}
				datasetStepCountOptions={["0", "1", "2", "3", "4", "5"]}
				onChangeTemplateStepCount={(value) => {
					if (!value || !/^[0-5]$/.test(value)) return;
					const count = Number(value);
					setSteps((current) =>
						Array.from(
							{ length: count },
							(_, index) =>
								current[index] ?? {
									id: newId(),
									title: `Step ${index + 1}`,
									detail: "",
									route: "reasoning/workbench",
								},
						),
					);
				}}
				templateSteps={steps}
				onUpdateTemplateStep={(index, field, value) =>
					setSteps((current) =>
						current.map((step, item) =>
							item === index ? { ...step, [field]: value } : step,
						),
					)
				}
				linkedPathOptions={(connection?.workbench?.linkedPaths ?? []).map((path) => ({
					value: path.id,
					label: `${path.label} (${path.status})`,
				}))}
				onCreateTemplate={save}
			/>
		</Stack>
	);
}
