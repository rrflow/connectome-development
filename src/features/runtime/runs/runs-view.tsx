import {
	Alert,
	Anchor,
	Badge,
	Box,
	Button,
	Group,
	Loader,
	Paper,
	ScrollArea,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import { useProject } from "../project/context";
import { formatCount, formatTime } from "../utils/format";

/** Runs change while the engine works, so both lists follow it. */
const RUNS_REFRESH_MS = 10_000;

const STATE_COLORS: Record<string, string> = {
	succeeded: "green",
	running: "blue",
	failed: "red",
	cancelled: "gray",
	cancel_requested: "yellow",
	paused: "yellow",
};

/** The native boundary sends integers as decimal text. */
function count(value: string) {
	return formatCount(Number(value));
}

/** The durable work the engine keeps for this project: learning jobs and tasks. */
export function RunsView() {
	const { client, session, sessionKey, open } = useProject();
	const [jobPage, setJobPage] = useState<{ sessionKey: string; after: string | null }>({
		sessionKey,
		after: null,
	});
	const [taskPage, setTaskPage] = useState({ sessionKey, cursor: "0" });
	const afterJob = jobPage.sessionKey === sessionKey ? jobPage.after : null;
	const afterTask = taskPage.sessionKey === sessionKey ? taskPage.cursor : "0";
	const jobs = useQuery({
		queryKey: ["rrd-attunement-jobs", sessionKey, afterJob],
		queryFn: async () => {
			const reply = await client.attunement({ action: "list", after_job_id: afterJob });
			if (reply.kind !== "page") throw new Error("Unexpected job list response");
			return reply.page;
		},
		enabled: Boolean(session),
		refetchInterval: RUNS_REFRESH_MS,
	});
	const tasks = useQuery({
		queryKey: ["rrd-task-list", sessionKey, afterTask],
		queryFn: async () => {
			const reply = await client.task({ action: "list", after_cursor: afterTask });
			if (reply.kind === "not_dispatched") throw new Error(reply.reason);
			if (reply.kind !== "page") throw new Error("Unexpected task list response");
			return reply;
		},
		enabled: Boolean(session),
		refetchInterval: RUNS_REFRESH_MS,
	});
	if (!session) return null;
	const nextJob = jobs.data?.next_after_job_id;

	return (
		<Stack gap="xl">
			<Box>
				<PrimaryTitle>Runs</PrimaryTitle>
				<Text mt="xs">
					The work the engine has kept a durable record of for this project. Learning jobs
					are the engine studying the project step by step; tasks are units of work it
					tracks. Both lists refresh every {RUNS_REFRESH_MS / 1000} seconds.
				</Text>
			</Box>
			<RunList
				title="Project learning jobs"
				about="Each job is one pass of the engine learning this project. Open the project plan to read a job's steps or control it."
				query={jobs}
				failure="The learning jobs could not be read"
				pager={
					(afterJob !== null || nextJob) && (
						<Group gap="xs">
							<Button
								variant="light"
								size="xs"
								disabled={afterJob === null}
								onClick={() => setJobPage({ sessionKey, after: null })}
							>
								First page
							</Button>
							<Button
								variant="light"
								size="xs"
								disabled={!nextJob}
								onClick={() => {
									if (nextJob) setJobPage({ sessionKey, after: nextJob });
								}}
							>
								Next page
							</Button>
						</Group>
					)
				}
			>
				{(page) =>
					page.jobs.length === 0 ? (
						<Text size="sm">The engine returned zero learning jobs.</Text>
					) : (
						<>
							<Text
								size="sm"
								c="dimmed"
							>
								{formatCount(page.jobs.length)}{" "}
								{page.jobs.length === 1 ? "job" : "jobs"} as the engine stored them
								at {formatTime(Number(page.observed_at_unix_ms))}.
							</Text>
							<ScrollArea>
								<Table
									highlightOnHover
									miw={860}
								>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>Job</Table.Th>
											<Table.Th>State</Table.Th>
											<Table.Th>Next step</Table.Th>
											<Table.Th>Revision</Table.Th>
											<Table.Th>Generation</Table.Th>
											<Table.Th>Checkpoints</Table.Th>
											<Table.Th>Created</Table.Th>
											<Table.Th>Last updated</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{page.jobs.map((job) => (
											<Table.Tr key={job.job_id}>
												<Table.Td>
													<Anchor
														component="button"
														ff="monospace"
														fz="sm"
														ta="left"
														title="Open the project plan"
														onClick={() => open("reasoning/plan")}
													>
														{job.job_id}
													</Anchor>
												</Table.Td>
												<Table.Td>
													<Badge color={STATE_COLORS[job.state]}>
														{job.state.replace("_", " ")}
													</Badge>
												</Table.Td>
												<Table.Td>
													{job.next_phase
														? job.next_phase.replace("_", " ")
														: "None"}
												</Table.Td>
												<Table.Td>{count(job.revision)}</Table.Td>
												<Table.Td>{count(job.generation)}</Table.Td>
												<Table.Td>{count(job.checkpoint_count)}</Table.Td>
												<Table.Td>
													{formatTime(Number(job.created_at_unix_ms))}
												</Table.Td>
												<Table.Td>
													{formatTime(Number(job.updated_at_unix_ms))}
												</Table.Td>
											</Table.Tr>
										))}
									</Table.Tbody>
								</Table>
							</ScrollArea>
						</>
					)
				}
			</RunList>
			<RunList
				title="Tasks"
				about="Each task is a unit of work with a goal. Open the tasks view to read one, set its limits, or run it."
				query={tasks}
				failure="The tasks could not be read"
				pager={
					(afterTask !== "0" || tasks.data?.truncated) && (
						<Group gap="xs">
							<Button
								variant="light"
								size="xs"
								disabled={afterTask === "0"}
								onClick={() => setTaskPage({ sessionKey, cursor: "0" })}
							>
								First page
							</Button>
							<Button
								variant="light"
								size="xs"
								disabled={!tasks.data?.truncated}
								onClick={() => {
									if (tasks.data?.truncated)
										setTaskPage({ sessionKey, cursor: tasks.data.next_cursor });
								}}
							>
								Next page
							</Button>
						</Group>
					)
				}
			>
				{(page) =>
					page.tasks.length === 0 ? (
						<Text size="sm">The engine returned zero tasks.</Text>
					) : (
						<ScrollArea>
							<Table
								highlightOnHover
								miw={720}
							>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Task</Table.Th>
										<Table.Th>Goal</Table.Th>
										<Table.Th>Status</Table.Th>
										<Table.Th>Recorded at cursor</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{page.tasks.map((task) => (
										<Table.Tr key={task.id}>
											<Table.Td>
												<Anchor
													component="button"
													fz="sm"
													ta="left"
													title={`Open the tasks view · ${task.id}`}
													onClick={() => open("reasoning/tasks")}
												>
													{task.title}
												</Anchor>
											</Table.Td>
											<Table.Td>{task.goal}</Table.Td>
											<Table.Td>
												<Badge variant="light">{task.status}</Badge>
											</Table.Td>
											<Table.Td>{count(task.cursor)}</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</ScrollArea>
					)
				}
			</RunList>
		</Stack>
	);
}

/** One list of runs with its own loading, failure and paging. */
function RunList<T>({
	title,
	about,
	query,
	failure,
	pager,
	children,
}: {
	title: string;
	about: string;
	query: UseQueryResult<T>;
	failure: string;
	pager: ReactNode;
	children: (page: T) => ReactNode;
}) {
	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack gap="sm">
				<Box>
					<Title order={4}>{title}</Title>
					<Text
						size="sm"
						c="dimmed"
					>
						{about}
					</Text>
				</Box>
				{query.isPending && (
					<Group>
						<Loader size="sm" />
						<Text size="sm">Asking the engine…</Text>
					</Group>
				)}
				{query.isError && (
					<Alert
						color="red"
						title={failure}
					>
						{describeRrdError(query.error)}
					</Alert>
				)}
				{query.data !== undefined && children(query.data)}
				{pager}
			</Stack>
		</Paper>
	);
}
