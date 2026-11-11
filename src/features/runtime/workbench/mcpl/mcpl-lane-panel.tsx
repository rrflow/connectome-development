import { Badge, Button, Group, Paper, Select, Stack, Text, Title } from "@mantine/core";
import { useMemo, useState } from "react";
import type { WorkbenchLearningEvent } from "~/shared/types";

interface WorkbenchLearningEventEntry {
	templateId: string;
	templateName: string;
	event: WorkbenchLearningEvent;
}

export function WorkbenchMcplLanePanel({
	learningEvents,
	runningEventIds,
	isTriggerActive,
	onRunLearningEvent,
	onOpenRoute,
}: {
	learningEvents: WorkbenchLearningEventEntry[];
	runningEventIds: string[];
	isTriggerActive: (event: WorkbenchLearningEvent) => boolean;
	onRunLearningEvent: (templateName: string, event: WorkbenchLearningEvent) => void;
	onOpenRoute: (route: string) => void;
}) {
	const [templateFilter, setTemplateFilter] = useState<string>("all");
	const [signalFilter, setSignalFilter] = useState<"all" | "active" | "inactive">("all");
	const templateOptions = useMemo(() => {
		const values = Array.from(
			new Set(learningEvents.map((entry) => entry.templateName)),
		).sort();
		return [
			{ value: "all", label: "All templates" },
			...values.map((value) => ({ value, label: value })),
		];
	}, [learningEvents]);
	const filteredEvents = useMemo(
		() =>
			learningEvents.filter((entry) => {
				const templateOk =
					templateFilter === "all" || entry.templateName === templateFilter;
				if (!templateOk) {
					return false;
				}
				const active = isTriggerActive(entry.event);
				if (signalFilter === "active") {
					return active;
				}
				if (signalFilter === "inactive") {
					return !active;
				}
				return true;
			}),
		[isTriggerActive, learningEvents, signalFilter, templateFilter],
	);
	const activeCount = filteredEvents.filter((entry) => isTriggerActive(entry.event)).length;

	return (
		<Paper
			withBorder
			p="lg"
		>
			<Stack>
				<Title order={4}>MCPL event lane</Title>
				<Text size="sm">
					Run and inspect scripted Did You Know, Knowledge Drop, and Factoid events
					independently from dataset and cloud setup.
				</Text>
				<Group grow>
					<Select
						label="Template scope"
						value={templateFilter}
						data={templateOptions}
						onChange={(next) => setTemplateFilter(next ?? "all")}
					/>
					<Select
						label="Signal scope"
						value={signalFilter}
						data={[
							{ value: "all", label: "All signals" },
							{ value: "active", label: "Active only" },
							{ value: "inactive", label: "Inactive only" },
						]}
						onChange={(next) =>
							setSignalFilter((next as "all" | "active" | "inactive" | null) ?? "all")
						}
					/>
				</Group>
				<Text size="xs">
					Showing {filteredEvents.length} events · active signals {activeCount}
				</Text>
				{learningEvents.length === 0 && (
					<Text
						size="sm"
						c="slate"
					>
						No MCPL events are authored yet. Add events in dataset templates.
					</Text>
				)}
				{filteredEvents.map((entry) => (
					<Paper
						key={`${entry.templateId}-${entry.event.id}`}
						withBorder
						p="sm"
					>
						<Group justify="space-between">
							<Text fw={650}>{entry.event.title}</Text>
							<Badge variant="light">
								{entry.event.kind} · {entry.event.mode}
							</Badge>
						</Group>
						<Text
							size="xs"
							c="slate"
						>
							template={entry.templateName}; component={entry.event.component}
						</Text>
						<Group justify="space-between">
							<Text size="xs">
								signals=
								{entry.event.triggers.map((trigger) => trigger.kind).join(", ") ||
									"none"}
							</Text>
							<Badge
								variant="light"
								color={isTriggerActive(entry.event) ? "orange" : "gray"}
							>
								{isTriggerActive(entry.event) ? "signal active" : "signal idle"}
							</Badge>
						</Group>
						<Group justify="space-between">
							<Button
								size="xs"
								variant={entry.event.requiresOperatorSignoff ? "light" : "subtle"}
								onClick={() => onRunLearningEvent(entry.templateName, entry.event)}
								loading={runningEventIds.includes(entry.event.id)}
							>
								{entry.event.requiresOperatorSignoff ? "Approve and run" : "Run"}
							</Button>
							{entry.event.mode === "interactive" && entry.event.route && (
								<Button
									size="xs"
									variant="subtle"
									onClick={() => onOpenRoute(entry.event.route ?? "workbench")}
								>
									Open route
								</Button>
							)}
						</Group>
					</Paper>
				))}
			</Stack>
		</Paper>
	);
}
