import {
	Alert,
	Button,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import type { ChangeEvent, Ref } from "react";
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

export function WorkbenchTemplateAuthoringPanel({
	connectionAvailable,
	templatesCount,
	onExportTemplates,
	onOpenTemplateImport,
	importInputRef,
	onImportTemplates,
	templateImportError,
	templateName,
	onChangeTemplateName,
	templateDescription,
	onChangeTemplateDescription,
	templateSchema,
	onChangeTemplateSchema,
	templateSkills,
	onChangeTemplateSkills,
	templateResearchReferences,
	onChangeTemplateResearchReferences,
	templateRequirements,
	onChangeTemplateRequirements,
	templateFilePatterns,
	onChangeTemplateFilePatterns,
	templateFolderPatterns,
	onChangeTemplateFolderPatterns,
	learningKind,
	learningKindOptions,
	onChangeLearningKind,
	learningMode,
	learningModeOptions,
	onChangeLearningMode,
	learningComponent,
	onChangeLearningComponent,
	learningTitle,
	onChangeLearningTitle,
	learningBody,
	onChangeLearningBody,
	learningRoute,
	workbenchRouteOptions,
	onChangeLearningRoute,
	learningRequiresSignoff,
	onChangeLearningRequiresSignoff,
	learningCatamorphismNote,
	onChangeLearningCatamorphismNote,
	learningActionName,
	learningActionOptions,
	onChangeLearningActionName,
	learningActionLabel,
	onChangeLearningActionLabel,
	learningActionPayload,
	onChangeLearningActionPayload,
	learningActions,
	onAddLearningAction,
	onRemoveLearningAction,
	learningTriggerKind,
	learningTriggerOptions,
	onChangeLearningTriggerKind,
	learningTriggerDescription,
	onChangeLearningTriggerDescription,
	learningTriggers,
	onAddLearningTrigger,
	onRemoveLearningTrigger,
	templateLearningEvents,
	onAddLearningEvent,
	onRemoveLearningEvent,
	templateStepCount,
	datasetStepCountOptions,
	onChangeTemplateStepCount,
	templateSteps,
	onUpdateTemplateStep,
	linkedPathOptions,
	onCreateTemplate,
}: {
	connectionAvailable: boolean;
	templatesCount: number;
	onExportTemplates: () => void;
	onOpenTemplateImport: () => void;
	importInputRef: Ref<HTMLInputElement>;
	onImportTemplates: (event: ChangeEvent<HTMLInputElement>) => void;
	templateImportError: string | null;
	templateName: string;
	onChangeTemplateName: (value: string) => void;
	templateDescription: string;
	onChangeTemplateDescription: (value: string) => void;
	templateSchema: string;
	onChangeTemplateSchema: (value: string) => void;
	templateSkills: string;
	onChangeTemplateSkills: (value: string) => void;
	templateResearchReferences: string;
	onChangeTemplateResearchReferences: (value: string) => void;
	templateRequirements: string;
	onChangeTemplateRequirements: (value: string) => void;
	templateFilePatterns: string;
	onChangeTemplateFilePatterns: (value: string) => void;
	templateFolderPatterns: string;
	onChangeTemplateFolderPatterns: (value: string) => void;
	learningKind: WorkbenchLearningEventKind;
	learningKindOptions: { value: WorkbenchLearningEventKind; label: string }[];
	onChangeLearningKind: (next: WorkbenchLearningEventKind | null) => void;
	learningMode: WorkbenchLearningEventMode;
	learningModeOptions: { value: WorkbenchLearningEventMode; label: string }[];
	onChangeLearningMode: (next: WorkbenchLearningEventMode | null) => void;
	learningComponent: "card" | "alert" | "badge";
	onChangeLearningComponent: (next: "card" | "alert" | "badge" | null) => void;
	learningTitle: string;
	onChangeLearningTitle: (value: string) => void;
	learningBody: string;
	onChangeLearningBody: (value: string) => void;
	learningRoute: string;
	workbenchRouteOptions: { value: string; label: string }[];
	onChangeLearningRoute: (next: string | null) => void;
	learningRequiresSignoff: boolean;
	onChangeLearningRequiresSignoff: (next: string | null) => void;
	learningCatamorphismNote: string;
	onChangeLearningCatamorphismNote: (value: string) => void;
	learningActionName: WorkbenchLearningActionName;
	learningActionOptions: { value: WorkbenchLearningActionName; label: string }[];
	onChangeLearningActionName: (next: WorkbenchLearningActionName | null) => void;
	learningActionLabel: string;
	onChangeLearningActionLabel: (value: string) => void;
	learningActionPayload: string;
	onChangeLearningActionPayload: (value: string) => void;
	learningActions: WorkbenchLearningAction[];
	onAddLearningAction: () => void;
	onRemoveLearningAction: (actionId: string) => void;
	learningTriggerKind: WorkbenchLearningTriggerKind;
	learningTriggerOptions: { value: WorkbenchLearningTriggerKind; label: string }[];
	onChangeLearningTriggerKind: (next: WorkbenchLearningTriggerKind | null) => void;
	learningTriggerDescription: string;
	onChangeLearningTriggerDescription: (value: string) => void;
	learningTriggers: WorkbenchLearningTrigger[];
	onAddLearningTrigger: () => void;
	onRemoveLearningTrigger: (triggerId: string) => void;
	templateLearningEvents: WorkbenchLearningEvent[];
	onAddLearningEvent: () => void;
	onRemoveLearningEvent: (eventId: string) => void;
	templateStepCount: string;
	datasetStepCountOptions: string[];
	onChangeTemplateStepCount: (next: string | null) => void;
	templateSteps: WorkbenchTemplateStep[];
	onUpdateTemplateStep: (
		index: number,
		field: keyof WorkbenchTemplateStep,
		value: string | undefined,
	) => void;
	linkedPathOptions: { value: string; label: string }[];
	onCreateTemplate: () => void;
}) {
	return (
		<Paper
			withBorder
			p="lg"
		>
			<Stack>
				<Title order={4}>Dataset templates (0–5 steps)</Title>
				<Text size="sm">
					Define reusable, configurable templates with schema and minimum requirements for
					reasoning-engine tests and experiments.
				</Text>
				<Group>
					<Button
						variant="light"
						onClick={onExportTemplates}
						disabled={templatesCount === 0}
					>
						Export templates
					</Button>
					<Button
						variant="light"
						onClick={onOpenTemplateImport}
					>
						Import templates
					</Button>
					<input
						ref={importInputRef}
						type="file"
						accept="application/json,.json"
						style={{ display: "none" }}
						onChange={(event) => onImportTemplates(event)}
					/>
				</Group>
				{templateImportError && (
					<Alert
						color="red"
						title="Template import failed"
					>
						{templateImportError}
					</Alert>
				)}
				<TextInput
					label="Template name"
					placeholder="Real project retrieval benchmark"
					value={templateName}
					onChange={(event) => onChangeTemplateName(event.currentTarget.value)}
				/>
				<Textarea
					label="Template description"
					placeholder="What this dataset workflow validates"
					minRows={2}
					value={templateDescription}
					onChange={(event) => onChangeTemplateDescription(event.currentTarget.value)}
				/>
				<TextInput
					label="Schema"
					placeholder="rrflow.workbench.dataset.v1"
					value={templateSchema}
					onChange={(event) => onChangeTemplateSchema(event.currentTarget.value)}
				/>
				<Textarea
					label="Skills (one per line)"
					placeholder="retrieval_accuracy&#10;vector_path_validation&#10;comparator_scoring"
					minRows={2}
					value={templateSkills}
					onChange={(event) => onChangeTemplateSkills(event.currentTarget.value)}
				/>
				<Textarea
					label="Research references (one per line)"
					placeholder="https://example.org/benchmark-method&#10;docs/reference/vector/memory-tiers.md"
					minRows={2}
					value={templateResearchReferences}
					onChange={(event) =>
						onChangeTemplateResearchReferences(event.currentTarget.value)
					}
				/>
				<Textarea
					label="Minimum requirements (one per line)"
					placeholder="Data source authorized&#10;Prompt set hash captured&#10;Comparator parity verified"
					minRows={3}
					value={templateRequirements}
					onChange={(event) => onChangeTemplateRequirements(event.currentTarget.value)}
				/>
				<Textarea
					label="File patterns (one per line)"
					placeholder="**/*.md&#10;**/*.rs&#10;eval/inputs/**/*.json"
					minRows={2}
					value={templateFilePatterns}
					onChange={(event) => onChangeTemplateFilePatterns(event.currentTarget.value)}
				/>
				<Textarea
					label="Folder patterns (one per line)"
					placeholder="docs/**&#10;crates/**&#10;eval/**"
					minRows={2}
					value={templateFolderPatterns}
					onChange={(event) => onChangeTemplateFolderPatterns(event.currentTarget.value)}
				/>
				<Paper
					withBorder
					p="sm"
				>
					<Stack>
						<Title order={5}>MCPL Learning scripted events</Title>
						<Text size="xs">
							Build Did You Know, Knowledge Drop, and Factoid events as A2UI
							components for passive or interactive flows, then catamorphize back to
							Clyffy.
						</Text>
						<Group grow>
							<Select
								label="Event kind"
								value={learningKind}
								data={learningKindOptions}
								onChange={(next) =>
									onChangeLearningKind(next as WorkbenchLearningEventKind | null)
								}
							/>
							<Select
								label="Mode"
								value={learningMode}
								data={learningModeOptions}
								onChange={(next) =>
									onChangeLearningMode(next as WorkbenchLearningEventMode | null)
								}
							/>
							<Select
								label="A2UI component"
								value={learningComponent}
								data={[
									{ value: "card", label: "Card" },
									{ value: "alert", label: "Alert" },
									{ value: "badge", label: "Badge" },
								]}
								onChange={(next) =>
									onChangeLearningComponent(
										next as "card" | "alert" | "badge" | null,
									)
								}
							/>
						</Group>
						<TextInput
							label="Title"
							value={learningTitle}
							onChange={(event) => onChangeLearningTitle(event.currentTarget.value)}
						/>
						<Textarea
							label="Body"
							minRows={2}
							value={learningBody}
							onChange={(event) => onChangeLearningBody(event.currentTarget.value)}
						/>
						<Select
							label="Interactive route"
							value={learningRoute}
							data={workbenchRouteOptions}
							disabled={learningMode !== "interactive"}
							onChange={onChangeLearningRoute}
						/>
						<Select
							label="Requires operator sign-off"
							value={learningRequiresSignoff ? "yes" : "no"}
							data={[
								{ value: "yes", label: "Yes" },
								{ value: "no", label: "No" },
							]}
							onChange={onChangeLearningRequiresSignoff}
						/>
						<TextInput
							label="Catamorphism note to Clyffy"
							placeholder="How this event maps back into Clyffy routines"
							value={learningCatamorphismNote}
							onChange={(event) =>
								onChangeLearningCatamorphismNote(event.currentTarget.value)
							}
						/>
						<Paper
							withBorder
							p="xs"
						>
							<Stack>
								<Title order={6}>Scripted actions</Title>
								<Group grow>
									<Select
										label="Action"
										value={learningActionName}
										data={learningActionOptions}
										onChange={(next) =>
											onChangeLearningActionName(
												next as WorkbenchLearningActionName | null,
											)
										}
									/>
									<TextInput
										label="Action label"
										value={learningActionLabel}
										onChange={(event) =>
											onChangeLearningActionLabel(event.currentTarget.value)
										}
									/>
									<TextInput
										label="Payload (optional)"
										placeholder="route name or free text payload"
										value={learningActionPayload}
										onChange={(event) =>
											onChangeLearningActionPayload(event.currentTarget.value)
										}
									/>
								</Group>
								<Group justify="space-between">
									<Text size="xs">Actions queued: {learningActions.length}</Text>
									<Button
										size="xs"
										variant="subtle"
										onClick={onAddLearningAction}
									>
										Add action
									</Button>
								</Group>
								{learningActions.map((action) => (
									<Group
										key={action.id}
										justify="space-between"
									>
										<Text size="xs">
											{action.name} · {action.label}
											{action.payload ? ` · ${action.payload}` : ""}
										</Text>
										<Button
											size="xs"
											variant="subtle"
											color="red"
											onClick={() => onRemoveLearningAction(action.id)}
										>
											Remove
										</Button>
									</Group>
								))}
							</Stack>
						</Paper>
						<Paper
							withBorder
							p="xs"
						>
							<Stack>
								<Title order={6}>Signal triggers</Title>
								<Group grow>
									<Select
										label="Trigger"
										value={learningTriggerKind}
										data={learningTriggerOptions}
										onChange={(next) =>
											onChangeLearningTriggerKind(
												next as WorkbenchLearningTriggerKind | null,
											)
										}
									/>
									<TextInput
										label="Trigger note"
										placeholder="Optional rationale or threshold note"
										value={learningTriggerDescription}
										onChange={(event) =>
											onChangeLearningTriggerDescription(
												event.currentTarget.value,
											)
										}
									/>
								</Group>
								<Group justify="space-between">
									<Text size="xs">
										Triggers queued: {learningTriggers.length}
									</Text>
									<Button
										size="xs"
										variant="subtle"
										onClick={onAddLearningTrigger}
									>
										Add trigger
									</Button>
								</Group>
								{learningTriggers.map((trigger) => (
									<Group
										key={trigger.id}
										justify="space-between"
									>
										<Text size="xs">
											{trigger.kind}
											{trigger.description ? ` · ${trigger.description}` : ""}
										</Text>
										<Button
											size="xs"
											variant="subtle"
											color="red"
											onClick={() => onRemoveLearningTrigger(trigger.id)}
										>
											Remove
										</Button>
									</Group>
								))}
							</Stack>
						</Paper>
						<Group justify="space-between">
							<Text size="xs">Queued events: {templateLearningEvents.length}</Text>
							<Button
								size="xs"
								variant="light"
								onClick={onAddLearningEvent}
								disabled={learningTitle.trim().length === 0}
							>
								Add learning event
							</Button>
						</Group>
						{templateLearningEvents.map((event) => (
							<Paper
								key={event.id}
								withBorder
								p="xs"
							>
								<Group justify="space-between">
									<Text size="sm">
										{event.kind} · {event.mode} · {event.component}
									</Text>
									<Button
										size="xs"
										variant="subtle"
										color="red"
										onClick={() => onRemoveLearningEvent(event.id)}
									>
										Remove
									</Button>
								</Group>
								<Text size="sm">{event.title}</Text>
								{event.body && (
									<Text
										size="xs"
										c="slate"
									>
										{event.body}
									</Text>
								)}
							</Paper>
						))}
					</Stack>
				</Paper>
				<Select
					label="Step count"
					value={templateStepCount}
					data={datasetStepCountOptions}
					onChange={onChangeTemplateStepCount}
				/>
				{templateSteps.map((step, index) => (
					<Paper
						key={step.id}
						withBorder
						p="sm"
					>
						<Stack>
							<Text fw={650}>Step {index + 1}</Text>
							<TextInput
								label="Title"
								value={step.title}
								onChange={(event) =>
									onUpdateTemplateStep(index, "title", event.currentTarget.value)
								}
							/>
							<TextInput
								label="Detail"
								value={step.detail}
								onChange={(event) =>
									onUpdateTemplateStep(index, "detail", event.currentTarget.value)
								}
							/>
							<Select
								label="Route"
								value={step.route}
								data={workbenchRouteOptions}
								onChange={(next) =>
									onUpdateTemplateStep(index, "route", next ?? "workbench")
								}
							/>
							<Select
								label="Linked path (optional)"
								value={step.linkedPathId ?? null}
								data={linkedPathOptions}
								placeholder="No path link"
								onChange={(next) =>
									onUpdateTemplateStep(index, "linkedPathId", next ?? undefined)
								}
							/>
						</Stack>
					</Paper>
				))}
				<Group justify="flex-end">
					<Button
						onClick={onCreateTemplate}
						disabled={!connectionAvailable || templateName.trim().length === 0}
					>
						Save template
					</Button>
				</Group>
			</Stack>
		</Paper>
	);
}
