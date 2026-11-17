import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Loader,
	Paper,
	Select,
	SimpleGrid,
	Stack,
	Table,
	Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import { iconErrorCircle, iconRefresh } from "~/shared/assets/icons";
import { busyRetry } from "../api/queries";
import { Section } from "../components/Section";
import { Stat } from "../components/stat";
import { useProject } from "../project/context";
import { shortDigest } from "../utils/format";
import { LastProposal } from "./last-proposal";

/** Where the engine would send model work, read from its endpoint configuration. */
export function RoutesView() {
	const { session, client, sessionKey, open } = useProject();
	const [picked, setPicked] = useState<string | null>(null);
	const tasks = useQuery({
		queryKey: ["rrd-routes-tasks", sessionKey],
		queryFn: async () => {
			const reply = await client.task({ action: "list", after_cursor: "0" });
			if (reply.kind !== "page") throw new Error("Unexpected task page response");
			return reply;
		},
		enabled: Boolean(session),
		...busyRetry,
	});
	const taskId = picked ?? tasks.data?.tasks[0]?.id ?? null;
	const routing = useQuery({
		queryKey: ["rrd-routes-policy", sessionKey, taskId],
		queryFn: async () => {
			if (!taskId) throw new Error("No task is selected");
			const reply = await client.task({ action: "prepare", task_id: taskId });
			if (reply.kind !== "prepared") throw new Error("Unexpected preparation response");
			return reply;
		},
		enabled: Boolean(session) && taskId !== null,
		...busyRetry,
	});

	if (!session) return null;

	const policy = routing.data;

	return (
		<Stack gap="xl">
			<Group align="flex-start">
				<Box flex={1}>
					<PrimaryTitle fz={26}>Routes</PrimaryTitle>
					<Text
						fz="lg"
						mt="xs"
					>
						When a task needs a model, the engine does not pick one at random. One
						configured endpoint, the controller, chooses which of the other configured
						endpoints should do the work. This page shows that setup as the engine
						reports it. Nothing here calls a model.
					</Text>
				</Box>
				<Button
					variant="light"
					leftSection={<Icon path={iconRefresh} />}
					loading={tasks.isFetching || routing.isFetching}
					onClick={() => {
						tasks.refetch();
						if (taskId) routing.refetch();
					}}
				>
					Read again
				</Button>
			</Group>

			{tasks.isPending && (
				<Stack align="center">
					<Loader />
					<Text c="slate">Asking the engine for its tasks.</Text>
				</Stack>
			)}

			{tasks.isError && (
				<Alert
					color="red"
					title="The engine's tasks could not be read"
					icon={<Icon path={iconErrorCircle} />}
				>
					{describeRrdError(tasks.error)}
				</Alert>
			)}

			{tasks.data && tasks.data.tasks.length === 0 && (
				<Paper p="md">
					<Text>
						The engine returned zero tasks. It reports its routing setup alongside a
						task, so there is no setup to read until this project has one.
					</Text>
					<Button
						mt="sm"
						variant="light"
						onClick={() => open("reasoning/tasks")}
					>
						Open Tasks
					</Button>
				</Paper>
			)}

			{tasks.data && tasks.data.tasks.length > 0 && (
				<Section
					title="Who chooses, and from which endpoints"
					description="The engine's selection policy, read together with the task below. The policy belongs to the engine, not to the task."
					rightSection={
						<Select
							aria-label="Task to read the routing setup with"
							w={320}
							allowDeselect={false}
							data={tasks.data.tasks.map((task) => ({
								value: task.id,
								label: task.title,
							}))}
							value={taskId}
							onChange={setPicked}
						/>
					}
				>
					{tasks.data.truncated && (
						<Text
							fz="sm"
							c="slate"
						>
							The engine has more tasks than this first page lists.
						</Text>
					)}
					{routing.isPending && <Loader />}
					{routing.isError && (
						<Alert
							color="red"
							title="The routing setup could not be read"
							icon={<Icon path={iconErrorCircle} />}
						>
							{describeRrdError(routing.error)}
						</Alert>
					)}
					{policy && (
						<Stack gap="md">
							{policy.unavailable && (
								<Alert
									color="orange"
									title="The engine cannot route work right now"
								>
									{policy.unavailable}
								</Alert>
							)}
							<SimpleGrid cols={{ base: 1, md: 3 }}>
								<Stat
									label="Controller endpoint"
									value={policy.controller ?? "none configured"}
									title={policy.controller ?? undefined}
								/>
								<Stat
									label="Longest wait for the controller"
									value={
										policy.wait_timeout_ms === null
											? "not reported"
											: `${Number(policy.wait_timeout_ms).toLocaleString()} ms`
									}
								/>
								<Stat
									label="Configuration digest"
									value={shortDigest(policy.configuration_sha256)}
									title={policy.configuration_sha256}
								/>
							</SimpleGrid>
							<Paper p="md">
								<Text
									fw={650}
									mb="xs"
								>
									Endpoints the controller may choose from
								</Text>
								{policy.candidates.length === 0 ? (
									<Text c="slate">
										The engine's selection policy lists zero candidate
										endpoints.
									</Text>
								) : (
									<Table fz="sm">
										<Table.Thead>
											<Table.Tr>
												<Table.Th>Endpoint binding</Table.Th>
												<Table.Th>Role</Table.Th>
											</Table.Tr>
										</Table.Thead>
										<Table.Tbody>
											{policy.candidates.map((binding) => (
												<Table.Tr key={binding}>
													<Table.Td ff="monospace">{binding}</Table.Td>
													<Table.Td>
														<Badge variant="light">candidate</Badge>
														{binding === policy.controller && (
															<Badge
																ml="xs"
																variant="outline"
															>
																also the controller
															</Badge>
														)}
													</Table.Td>
												</Table.Tr>
											))}
										</Table.Tbody>
									</Table>
								)}
							</Paper>
						</Stack>
					)}
				</Section>
			)}

			<LastProposal />
		</Stack>
	);
}
