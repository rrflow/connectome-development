import { Badge, Box, Button, Group, Paper, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { type UseQueryResult, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { useAbsoluteLocation } from "~/hooks/app/routing";
import {
	describeRrdError,
	isUnreachable,
	type RrdHandshake,
	RrdRuntimeClient,
} from "~/rrflow/runtime";
import { iconRefresh } from "~/shared/assets/icons";
import type { Connection } from "~/shared/types";
import { useConfigStore } from "~/shell/stores/config";
import { useProject } from "../project/context";
import { formatTime } from "../utils/format";

const endpointOf = (connection: Connection) =>
	`${connection.authentication.protocol}://${connection.authentication.hostname}`;

const words = (value: string) => value.replaceAll("_", " ");

/** What the engine at a saved address answered just now, in one word. */
function reach(query: UseQueryResult<RrdHandshake>) {
	// A handshake kept from an earlier read must not claim an engine that no longer answers.
	if (query.isError) {
		return isUnreachable(query.error)
			? { label: "Not reachable", color: "yellow" }
			: { label: "Refused", color: "red" };
	}
	if (query.data) return { label: "Reachable", color: "green" };
	return { label: "Checking", color: "gray" };
}

/** Every saved RRFlow project connection, with what its engine answers right now. */
export function ConnectionsView() {
	const { id } = useProject();
	const [, navigate] = useAbsoluteLocation();
	const saved = useConfigStore((state) => state.connections);
	const connections = useMemo(
		() => saved.filter((connection) => connection.target === "runtime"),
		[saved],
	);
	// The same key the project layout reads under, so one project has one handshake.
	const handshakes = useQueries({
		queries: connections.map((connection) => {
			const endpoint = endpointOf(connection);
			return {
				queryKey: [
					"rrd-runtime-handshake",
					connection.id,
					endpoint,
					connection.runtimeInstance,
				],
				queryFn: () =>
					new RrdRuntimeClient(endpoint, connection.runtimeInstance).handshake(),
				retry: false,
				refetchOnMount: "always" as const,
			};
		}),
	});
	const checking = handshakes.some((query) => query.isFetching);
	const answered = handshakes.filter((query) => query.data && !query.isError).length;

	return (
		<Stack gap="lg">
			<Group
				justify="space-between"
				align="flex-start"
			>
				<Box flex={1}>
					<PrimaryTitle>Connections</PrimaryTitle>
					<Text mt={4}>
						Every RRFlow project saved in this app. Each one is asked, right now,
						whether its engine is answering and what it says about itself. Choose a
						project to open it.
					</Text>
				</Box>
				<Button
					variant="light"
					size="xs"
					leftSection={<Icon path={iconRefresh} />}
					loading={checking}
					onClick={() => {
						for (const query of handshakes) query.refetch();
					}}
				>
					Check again
				</Button>
			</Group>

			{connections.length === 0 ? (
				<Text c="slate">This app has zero saved RRFlow project connections.</Text>
			) : (
				<>
					<Text
						fz="sm"
						c="slate"
					>
						{connections.length} saved · {answered} answering
						{checking ? " · checking" : ""}
					</Text>
					<Paper p="md">
						<ScrollArea>
							<Table
								fz="sm"
								highlightOnHover
								verticalSpacing="sm"
							>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Project</Table.Th>
										<Table.Th>Address</Table.Th>
										<Table.Th>Right now</Table.Th>
										<Table.Th>Engine instance</Table.Th>
										<Table.Th>Engine version</Table.Th>
										<Table.Th>Storage</Table.Th>
										<Table.Th>Checked</Table.Th>
										<Table.Th />
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{connections.map((connection, index) => (
										<ConnectionRow
											key={connection.id}
											connection={connection}
											query={handshakes[index]}
											current={connection.id === id}
											onOpen={() => navigate(`/runtime/${connection.id}`)}
										/>
									))}
								</Table.Tbody>
							</Table>
						</ScrollArea>
					</Paper>
				</>
			)}
		</Stack>
	);
}

interface ConnectionRowProps {
	connection: Connection;
	query: UseQueryResult<RrdHandshake>;
	current: boolean;
	onOpen: () => void;
}

function ConnectionRow({ connection, query, current, onOpen }: ConnectionRowProps) {
	const state = reach(query);
	// Only what the engine said in the read on screen; nothing from an older answer.
	const service = query.isError ? undefined : query.data?.service;
	const pending = query.isPending ? "…" : "—";

	return (
		<Table.Tr
			onClick={current ? undefined : onOpen}
			style={{ cursor: current ? "default" : "pointer" }}
		>
			<Table.Td>
				<Group
					gap="xs"
					wrap="nowrap"
				>
					<Text
						fw={600}
						fz="sm"
					>
						{connection.name}
					</Text>
					{current && (
						<Badge
							variant="light"
							size="sm"
						>
							This project
						</Badge>
					)}
				</Group>
			</Table.Td>
			<Table.Td ff="monospace">{endpointOf(connection)}</Table.Td>
			<Table.Td>
				<Badge
					variant="dot"
					color={state.color}
				>
					{state.label}
				</Badge>
				{query.isError && (
					<Text
						fz="xs"
						c="dimmed"
						mt={4}
						maw={320}
						style={{ overflowWrap: "anywhere" }}
					>
						{describeRrdError(query.error)}
					</Text>
				)}
			</Table.Td>
			<Table.Td ff="monospace">{service ? service.instance.id : pending}</Table.Td>
			<Table.Td>
				{service ? `${service.implementation} ${service.implementation_version}` : pending}
			</Table.Td>
			<Table.Td>{service ? words(service.deployment.storage_profile) : pending}</Table.Td>
			<Table.Td>
				{query.isError
					? formatTime(query.errorUpdatedAt)
					: query.data
						? formatTime(query.data.connected_at_unix_ms)
						: pending}
			</Table.Td>
			<Table.Td>
				{!current && (
					<Button
						variant="subtle"
						size="compact-sm"
						onClick={(event) => {
							event.stopPropagation();
							onOpen();
						}}
					>
						Open
					</Button>
				)}
			</Table.Td>
		</Table.Tr>
	);
}
