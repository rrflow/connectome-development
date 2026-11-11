import { Alert, Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type {
	WorkbenchDatasetTemplate,
	WorkbenchLearningEvent,
	WorkbenchLearningTrigger,
	WorkbenchLinkedPath,
} from "~/shared/types";

export function WorkbenchTemplateLibraryPanel({
	eventExecutionError,
	templates,
	linkedPaths,
	onRemoveTemplate,
	onOpenRoute,
	isTriggerActive,
	onRunLearningEvent,
	runningEventIds,
}: {
	eventExecutionError: string | null;
	templates: WorkbenchDatasetTemplate[];
	linkedPaths: WorkbenchLinkedPath[];
	onRemoveTemplate: (templateId: string) => void;
	onOpenRoute: (route: string) => void;
	isTriggerActive: (trigger: WorkbenchLearningTrigger) => boolean;
	onRunLearningEvent: (templateName: string, event: WorkbenchLearningEvent) => void;
	runningEventIds: string[];
}) {
	return (
		<Paper
			withBorder
			p="lg"
		>
			<Stack>
				<Title order={5}>Saved templates</Title>
				{eventExecutionError && (
					<Alert
						color="red"
						title="Scripted event execution failed"
					>
						{eventExecutionError}
					</Alert>
				)}
				{templates.length === 0 && (
					<Text
						size="sm"
						c="slate"
					>
						No dataset templates saved yet.
					</Text>
				)}
				{templates.map((template) => (
					<Paper
						key={template.id}
						withBorder
						p="sm"
					>
						<Stack gap="xs">
							<Group justify="space-between">
								<Text fw={650}>{template.name}</Text>
								<Group gap="xs">
									<Badge variant="light">
										{template.steps.length} step
										{template.steps.length === 1 ? "" : "s"}
									</Badge>
									<Button
										size="xs"
										variant="subtle"
										color="red"
										onClick={() => onRemoveTemplate(template.id)}
									>
										Remove
									</Button>
								</Group>
							</Group>
							<Text size="sm">{template.description}</Text>
							<Text
								size="xs"
								ff="monospace"
							>
								schema={template.schema || "unset"}
							</Text>
							<Text size="xs">
								Skills:{" "}
								{template.skills.length > 0 ? template.skills.join(", ") : "none"}
							</Text>
							<Text size="xs">
								Research refs:{" "}
								{template.researchReferences.length > 0
									? template.researchReferences.join(" • ")
									: "none"}
							</Text>
							<Text size="xs">
								Requirements:{" "}
								{template.minimumRequirements.length > 0
									? template.minimumRequirements.join(" • ")
									: "none"}
							</Text>
							<Text size="xs">
								File patterns:{" "}
								{template.filePatterns.length > 0
									? template.filePatterns.join(", ")
									: "none"}
							</Text>
							<Text size="xs">
								Folder patterns:{" "}
								{template.folderPatterns.length > 0
									? template.folderPatterns.join(", ")
									: "none"}
							</Text>
							{template.steps.map((step, index) => {
								const linked = step.linkedPathId
									? linkedPaths.find((entry) => entry.id === step.linkedPathId)
									: undefined;
								return (
									<Group
										key={step.id}
										justify="space-between"
									>
										<Text
											size="xs"
											c="slate"
										>
											{index + 1}. {step.title} → {step.route}
											{linked
												? ` · link=${linked.label} (${linked.status})`
												: ""}
										</Text>
										<Button
											size="xs"
											variant="subtle"
											onClick={() => onOpenRoute(step.route)}
										>
											Open
										</Button>
									</Group>
								);
							})}
							{template.learningEvents.length > 0 && (
								<Stack gap="xs">
									<Text
										size="xs"
										fw={650}
									>
										MCPL Learning events
									</Text>
									{template.learningEvents.map(
										(event: WorkbenchLearningEvent) => (
											<Paper
												key={event.id}
												withBorder
												p="xs"
											>
												<Stack gap="xs">
													<Group justify="space-between">
														<Badge variant="light">{event.kind}</Badge>
														<Text size="xs">
															{event.mode} · {event.component}
														</Text>
													</Group>
													{event.component === "alert" ? (
														<Alert title={event.title}>
															{event.body || "No body provided."}
														</Alert>
													) : event.component === "badge" ? (
														<Group>
															<Badge>{event.title}</Badge>
															<Text size="xs">{event.body}</Text>
														</Group>
													) : (
														<>
															<Text size="sm">{event.title}</Text>
															{event.body && (
																<Text
																	size="xs"
																	c="slate"
																>
																	{event.body}
																</Text>
															)}
														</>
													)}
													<Text
														size="xs"
														c="slate"
													>
														catamorphism → {event.catamorphismTarget}
														{event.catamorphismNote
															? ` (${event.catamorphismNote})`
															: ""}
													</Text>
													{event.triggers.length > 0 && (
														<Text size="xs">
															signals:{" "}
															{event.triggers
																.map((trigger) => trigger.kind)
																.join(", ")}
														</Text>
													)}
													{event.actions.length > 0 && (
														<Text size="xs">
															actions:{" "}
															{event.actions
																.map((action) => action.name)
																.join(", ")}
														</Text>
													)}
													{event.triggers.some((trigger) =>
														isTriggerActive(trigger),
													) && (
														<Badge
															size="sm"
															color="orange"
															variant="light"
														>
															Signal active
														</Badge>
													)}
													{event.mode === "interactive" &&
														event.route && (
															<Button
																size="xs"
																variant="light"
																onClick={() =>
																	onOpenRoute(
																		event.route ?? "workbench",
																	)
																}
															>
																Interact
															</Button>
														)}
													<Group>
														<Button
															size="xs"
															variant={
																event.requiresOperatorSignoff
																	? "light"
																	: "subtle"
															}
															onClick={() =>
																onRunLearningEvent(
																	template.name,
																	event,
																)
															}
															loading={runningEventIds.includes(
																event.id,
															)}
														>
															{event.requiresOperatorSignoff
																? "Approve and run"
																: "Run scripted event"}
														</Button>
													</Group>
												</Stack>
											</Paper>
										),
									)}
								</Stack>
							)}
						</Stack>
					</Paper>
				))}
			</Stack>
		</Paper>
	);
}
