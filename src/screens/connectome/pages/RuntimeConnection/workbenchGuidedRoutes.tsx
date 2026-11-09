import {
	Alert,
	Box,
	Button,
	Group,
	Paper,
	Select,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useState } from "react";
import { resolveTemplateRoute } from "./workbenchTemplateLibrary";

interface WorkbenchRouteStep {
	id: string;
	title: string;
	detail: string;
	route: string;
}

interface WorkbenchRoutePlan {
	id: string;
	title: string;
	purpose: string;
	steps: WorkbenchRouteStep[];
}

interface Workskill {
	id: string;
	title: string;
	outcome: string;
	route: string;
}

interface Routine {
	id: string;
	title: string;
	description: string;
	stepRoutes: string[];
}

const routePlans: WorkbenchRoutePlan[] = [
	{
		id: "readiness-baseline",
		title: "Readiness baseline route",
		purpose: "Validate schema, graph, vectors, and storage counters before new work.",
		steps: [
			{
				id: "models",
				title: "Confirm data models",
				detail: "Validate schema revision, model families, and queryable tables.",
				route: "knowledge/models",
			},
			{
				id: "records",
				title: "Inspect records & relations",
				detail: "Confirm record coverage and relation topology from the same session.",
				route: "knowledge/records",
			},
			{
				id: "vectors",
				title: "Inspect vectors",
				detail: "Check collection inventory, memory tiers, and nearest-neighbor behavior.",
				route: "knowledge/vectors",
			},
			{
				id: "storage",
				title: "Inspect storage",
				detail: "Review physical counters and retention status before change execution.",
				route: "knowledge/storage",
			},
		],
	},
	{
		id: "cold-vector-follow-up",
		title: "Cold vector follow-up route",
		purpose: "Investigate cold-served vectors and storage-tier pressure signals.",
		steps: [
			{
				id: "storage",
				title: "Read storage cold-path signals",
				detail: "Check cache/cold metrics and observed-at timestamp from storage diagnostics.",
				route: "knowledge/storage",
			},
			{
				id: "vectors",
				title: "Validate vector search path",
				detail: "Confirm access path behavior and search evidence after cold-source reads.",
				route: "knowledge/vectors",
			},
			{
				id: "workbench",
				title: "Record remediation receipt",
				detail: "Capture diagnostics and accepted follow-up decisions in Workbench.",
				route: "workbench",
			},
		],
	},
];

const workskills: Workskill[] = [
	{
		id: "schema-oracle",
		title: "Schema oracle",
		outcome: "Confirms the schema and model surface before query or retrieval work.",
		route: "knowledge/models",
	},
	{
		id: "retrieval-oracle",
		title: "Retrieval oracle",
		outcome: "Validates graph records/relations and read-cursor consistency for recall.",
		route: "knowledge/records",
	},
	{
		id: "vector-cold-oracle",
		title: "Vector cold-oracle",
		outcome: "Verifies vector access path evidence and cold-trigger counters.",
		route: "knowledge/vectors",
	},
];

const routines: Routine[] = [
	{
		id: "release-readiness-loop",
		title: "Release readiness loop",
		description:
			"Run baseline route, launch governed observe flight, record receipt, and verify storage counters.",
		stepRoutes: [
			"knowledge/models",
			"knowledge/records",
			"knowledge/vectors",
			"knowledge/storage",
			"workbench",
		],
	},
	{
		id: "cold-trigger-triage",
		title: "Cold trigger triage",
		description: "Investigate cold-path pressure and validate vector-search implications.",
		stepRoutes: ["knowledge/storage", "knowledge/vectors", "workbench"],
	},
];

export function WorkbenchGuidedRoutes({ onOpenRoute }: { onOpenRoute: (route: string) => void }) {
	const [selectedRouteId, setSelectedRouteId] = useState(routePlans[0].id);
	const [selectedRoutineId, setSelectedRoutineId] = useState(routines[0].id);
	const [error, setError] = useState<string | null>(null);
	const selectedRoute =
		routePlans.find((candidate) => candidate.id === selectedRouteId) ?? routePlans[0];
	const selectedRoutine =
		routines.find((candidate) => candidate.id === selectedRoutineId) ?? routines[0];
	const open = (route: string) => {
		const resolved = resolveTemplateRoute(route);
		if (!resolved) {
			setError(`Route unavailable: ${route}`);
			return;
		}
		setError(null);
		onOpenRoute(resolved);
	};
	return (
		<Stack>
			{error && (
				<Alert
					color="red"
					title="Guided route unavailable"
				>
					{error}
				</Alert>
			)}
			<Paper
				withBorder
				p="lg"
			>
				<Stack>
					<Title order={4}>Guided routes</Title>
					<Text size="sm">
						Navigation suggestions only. Opening a step does not execute or verify it.
					</Text>
					<Select
						label="Route plan"
						value={selectedRoute.id}
						data={routePlans.map((route) => ({ value: route.id, label: route.title }))}
						allowDeselect={false}
						onChange={(next) => {
							if (next) setSelectedRouteId(next);
						}}
					/>
					<Text size="sm">{selectedRoute.purpose}</Text>
					{selectedRoute.steps.map((step, index) => (
						<Paper
							key={step.id}
							withBorder
							p="sm"
						>
							<Group justify="space-between">
								<Box>
									<Text fw={650}>
										Step {index + 1}: {step.title}
									</Text>
									<Text size="sm">{step.detail}</Text>
								</Box>
								<Button
									size="xs"
									variant="light"
									onClick={() => open(step.route)}
								>
									Open step
								</Button>
							</Group>
						</Paper>
					))}
				</Stack>
			</Paper>
			<SimpleGrid cols={{ base: 1, md: 2 }}>
				<Paper
					withBorder
					p="lg"
				>
					<Stack>
						<Title order={4}>Workskills</Title>
						<Text size="sm">
							Choose a lens to investigate the intended outcome; no skill runs
							automatically.
						</Text>
						{workskills.map((skill) => (
							<Paper
								key={skill.id}
								withBorder
								p="sm"
							>
								<Group justify="space-between">
									<Box>
										<Text fw={650}>{skill.title}</Text>
										<Text size="sm">{skill.outcome}</Text>
									</Box>
									<Button
										size="xs"
										variant="subtle"
										onClick={() => open(skill.route)}
									>
										Open skill lens
									</Button>
								</Group>
							</Paper>
						))}
					</Stack>
				</Paper>
				<Paper
					withBorder
					p="lg"
				>
					<Stack>
						<Title order={4}>Routines</Title>
						<Text size="sm">
							Review the suggested steps; navigation does not start an engine routine.
						</Text>
						<Select
							label="Routine"
							value={selectedRoutine.id}
							data={routines.map((routine) => ({
								value: routine.id,
								label: routine.title,
							}))}
							allowDeselect={false}
							onChange={(next) => {
								if (next) setSelectedRoutineId(next);
							}}
						/>
						<Text size="sm">{selectedRoutine.description}</Text>
						{selectedRoutine.stepRoutes.map((route, index) => (
							<Button
								key={`${index}-${route}`}
								size="xs"
								variant="subtle"
								onClick={() => open(route)}
							>
								Step {index + 1}: {resolveTemplateRoute(route) ?? route}
							</Button>
						))}
						<Button
							size="xs"
							variant="light"
							onClick={() => open(selectedRoutine.stepRoutes[0])}
						>
							Start routine
						</Button>
						<Button
							size="xs"
							variant="subtle"
							onClick={() => open("workbench")}
						>
							Record outcome
						</Button>
					</Stack>
				</Paper>
			</SimpleGrid>
		</Stack>
	);
}
