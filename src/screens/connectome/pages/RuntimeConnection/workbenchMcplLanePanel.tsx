import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { WorkbenchLearningEvent } from "~/types";

interface WorkbenchLearningEventEntry {
	templateId: string;
	templateName: string;
	event: WorkbenchLearningEvent;
}

export function WorkbenchMcplLanePanel({
	learningEvents,
	runningEventIds,
	onRunLearningEvent,
}: {
	learningEvents: WorkbenchLearningEventEntry[];
	runningEventIds: string[];
	onRunLearningEvent: (templateName: string, event: WorkbenchLearningEvent) => void;
}) {
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
				{learningEvents.length === 0 && (
					<Text
						size="sm"
						c="slate"
					>
						No MCPL events are authored yet. Add events in dataset templates.
					</Text>
				)}
				{learningEvents.map((entry) => (
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
							<Button
								size="xs"
								variant={entry.event.requiresOperatorSignoff ? "light" : "subtle"}
								onClick={() => onRunLearningEvent(entry.templateName, entry.event)}
								loading={runningEventIds.includes(entry.event.id)}
							>
								{entry.event.requiresOperatorSignoff ? "Approve and run" : "Run"}
							</Button>
						</Group>
					</Paper>
				))}
			</Stack>
		</Paper>
	);
}
