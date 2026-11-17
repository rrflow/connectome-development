import { Alert, Badge, Box, Group, Loader, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { useMemo } from "react";
import { adapter } from "~/adapter";
import { displayPath } from "~/components/ActionBar/installation-facts";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { connectionProject } from "~/rrflow/instances";
import { describeRrdError } from "~/rrflow/runtime";
import { iconErrorCircle } from "~/shared/assets/icons";
import type { InstanceState, ProjectInstance } from "~/shared/types";
import { useConfigStore } from "~/shell/stores/config";
import { useProject } from "../project/context";

/** The engine list follows the desktop app's registry while it is open. */
const ENGINES_REFRESH_MS = 5_000;

const STATE_COLOR: Record<InstanceState, string> = {
	starting: "blue",
	ready: "green",
	stopping: "orange",
	stopped: "gray",
	failed: "red",
};

const STATE_LABEL: Record<InstanceState, string> = {
	starting: "Starting",
	ready: "Running",
	stopping: "Stopping",
	stopped: "Stopped",
	failed: "Failed",
};

const lastSegment = (project: string) =>
	project.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? project;

/** The engine processes this desktop app tracks for the saved projects, read live. */
export function EnginesView() {
	const { connection, endpoint, handshake } = useProject();
	const connections = useConfigStore((state) => state.connections);
	const known = useMemo(
		() =>
			connections.flatMap((candidate) => {
				const project = connectionProject(candidate);
				return project ? [{ project, name: candidate.name }] : [];
			}),
		[connections],
	);
	const desktop = isTauri();
	// The same read, under the same key, as the "Project engines" dialog.
	const status = useQuery({
		queryKey: ["project-instances", known.map((entry) => entry.project)],
		queryFn: () => adapter.projectInstances(known.map((entry) => entry.project)),
		enabled: desktop,
		refetchInterval: ENGINES_REFRESH_MS,
	});
	const ownProject = connectionProject(connection);
	const servesThisProject = (instance: ProjectInstance) => {
		const estate = instance.estate;
		if (estate && estate.endpoint === endpoint) {
			return !handshake || estate.instance === handshake.service.instance.id;
		}
		return ownProject !== undefined && instance.project === ownProject;
	};
	const instances = status.data?.instances ?? [];
	const running = instances.filter((instance) => instance.state === "ready").length;

	return (
		<Stack gap="lg">
			<Box>
				<PrimaryTitle>Engines</PrimaryTitle>
				<Text mt={4}>
					Each project is served by its own engine: a program running on this computer
					that keeps the project's data and answers questions about it. These are the
					engines this desktop app is tracking, checked every {ENGINES_REFRESH_MS / 1000}{" "}
					seconds.
				</Text>
			</Box>

			{!desktop && (
				<Alert
					color="blue"
					title="Engines can only be read in the desktop app"
				>
					The desktop app starts and tracks the engine programs on this computer. This
					window is running in a web browser, which cannot ask it, so no engine list was
					read.
				</Alert>
			)}
			{status.isError && (
				<Alert
					color="red"
					title="The engine list could not be read"
					icon={<Icon path={iconErrorCircle} />}
				>
					{describeRrdError(status.error)}
				</Alert>
			)}
			{desktop && status.isPending && (
				<Group>
					<Loader size="sm" />
					<Text c="slate">Asking the desktop app for its engines…</Text>
				</Group>
			)}
			{status.data && (
				<>
					<Text
						fz="sm"
						c="slate"
					>
						{instances.length} tracked · {running} running · registry change{" "}
						{status.data.revision}
					</Text>
					{instances.length === 0 && (
						<Text c="slate">
							The desktop app answered with zero engines for the {known.length} saved
							project {known.length === 1 ? "folder" : "folders"} it was asked about.
						</Text>
					)}
					{instances.map((instance) => (
						<EngineCard
							key={instance.project}
							instance={instance}
							name={
								known.find((entry) => entry.project === instance.project)?.name ??
								lastSegment(instance.project)
							}
							current={servesThisProject(instance)}
						/>
					))}
				</>
			)}
		</Stack>
	);
}

interface EngineCardProps {
	instance: ProjectInstance;
	name: string;
	current: boolean;
}

function EngineCard({ instance, name, current }: EngineCardProps) {
	const estate = instance.estate;
	const busy = instance.state === "starting" || instance.state === "stopping";

	return (
		<Paper
			p="md"
			withBorder
		>
			<Group
				justify="space-between"
				wrap="nowrap"
				align="flex-start"
			>
				<Group gap="xs">
					<Text fw={600}>{name}</Text>
					{current && (
						<Badge
							variant="light"
							size="sm"
						>
							Serves this project
						</Badge>
					)}
				</Group>
				<Badge
					variant="light"
					color={STATE_COLOR[instance.state]}
					leftSection={
						busy ? (
							<Loader
								size={10}
								color={STATE_COLOR[instance.state]}
							/>
						) : undefined
					}
					style={{ flexShrink: 0 }}
				>
					{STATE_LABEL[instance.state]}
				</Badge>
			</Group>
			<Text
				fz="sm"
				mt={4}
				style={{ overflowWrap: "anywhere" }}
			>
				{instance.detail}
			</Text>
			<SimpleGrid
				cols={{ base: 1, md: 2 }}
				mt="sm"
				spacing="xs"
			>
				<Fact
					label="Project folder"
					value={displayPath(instance.project)}
				/>
				<Fact
					label="Started by"
					value={
						instance.origin === "connectome"
							? "This desktop app"
							: "Something outside this app"
					}
					plain
				/>
				{estate ? (
					<>
						<Fact
							label="Address"
							value={estate.endpoint}
						/>
						<Fact
							label="Instance id"
							value={estate.instance}
						/>
						{estate.engine && (
							<Fact
								label="Engine program"
								value={displayPath(estate.engine.path)}
							/>
						)}
					</>
				) : (
					<Fact
						label="Address and instance id"
						value="The desktop app reports none while this engine is not running."
						plain
					/>
				)}
			</SimpleGrid>
		</Paper>
	);
}

function Fact({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
	return (
		<Box>
			<Text
				fz="xs"
				tt="uppercase"
				c="slate"
			>
				{label}
			</Text>
			<Text
				fz="sm"
				ff={plain ? undefined : "monospace"}
				style={{ overflowWrap: "anywhere" }}
			>
				{value}
			</Text>
		</Box>
	);
}
