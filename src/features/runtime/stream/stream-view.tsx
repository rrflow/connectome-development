import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Loader,
	Paper,
	ScrollArea,
	Slider,
	Stack,
	Table,
	Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import { Term } from "../components/glossary";
import { useProject } from "../project/context";
import { formatCount, formatTime } from "../utils/format";
import { ChangeDetail } from "./change-detail";

/** The most changes the native client reads in one page. */
const PAGE = 256;
/** While following, the window start moves in steps so each change is not a new read. */
const FOLLOW_STEP = PAGE / 2;
const STREAM_REFRESH_MS = 5_000;

/** Where a window that ends at the newest change starts. */
function followStart(head: number) {
	return Math.max(0, (Math.ceil(head / FOLLOW_STEP) - 2) * FOLLOW_STEP);
}

/** The engine's ordered change log, one page at a time, with a scrubber. */
export function StreamView() {
	const { client, session, sessionKey, onSelect, openLens } = useProject();
	// No chosen start means the view follows the newest changes.
	const [start, setStart] = useState<{ sessionKey: string; after: number } | null>(null);
	const [picked, setPicked] = useState<{ sessionKey: string; cursor: number } | null>(null);
	const chosen = start?.sessionKey === sessionKey ? start.after : null;
	const head = useQuery({
		queryKey: ["rrd-changes-head", sessionKey],
		queryFn: () => client.changes(0, 1),
		enabled: Boolean(session),
		staleTime: Number.POSITIVE_INFINITY,
	});
	// Each page reports the engine's newest cursor, so polling moves the window.
	const [seen, setSeen] = useState<{ sessionKey: string; head: number } | null>(null);
	const newest = seen?.sessionKey === sessionKey ? seen.head : head.data?.head_cursor;
	const target = chosen ?? (newest === undefined ? null : followStart(newest));
	const page = useQuery({
		queryKey: ["rrd-changes", sessionKey, target],
		queryFn: () => {
			if (target === null) throw new Error("The change log position is not known yet");
			return client.changes(target, PAGE);
		},
		enabled: Boolean(session) && target !== null,
		refetchInterval: STREAM_REFRESH_MS,
		// A page of another session is never shown while this one loads.
		placeholderData: (previous, query) =>
			query?.queryKey[1] === sessionKey ? previous : undefined,
	});
	const reported = page.isPlaceholderData ? undefined : page.data?.head_cursor;
	useEffect(() => {
		if (reported !== undefined) setSeen({ sessionKey, head: reported });
	}, [reported, sessionKey]);
	if (!session) return null;

	const view = page.data;
	const changes = view?.changes ?? [];
	const pickedCursor = picked?.sessionKey === sessionKey ? picked.cursor : null;
	const found = changes.findIndex((change) => change.cursor === pickedCursor);
	const index = found === -1 ? changes.length - 1 : found;
	const current = changes[index];
	const pick = (at: number) => {
		const change = changes[at];
		if (change) setPicked({ sessionKey, cursor: change.cursor });
	};
	const following = chosen === null;
	const failure = page.error ?? head.error;

	return (
		<Stack gap="lg">
			<Box>
				<PrimaryTitle>Temporal stream</PrimaryTitle>
				<Text mt="xs">
					Every change the engine has committed to this project, in the order it happened.
					Each change has a <Term id="cursor">cursor</Term>, its place in that order. Drag
					the scrubber to step back and forward in time; new changes are read every{" "}
					{STREAM_REFRESH_MS / 1000} seconds.
				</Text>
			</Box>
			{failure && (
				<Alert
					color="red"
					title="The change log could not be read"
				>
					{describeRrdError(failure)}
				</Alert>
			)}
			{!view && !failure && (
				<Group>
					<Loader size="sm" />
					<Text size="sm">Reading the change log…</Text>
				</Group>
			)}
			{view && (
				<>
					<Group
						justify="space-between"
						align="flex-end"
					>
						<Box>
							<Group gap="xs">
								<Badge
									variant="dot"
									color={following ? "green" : "gray"}
								>
									{following ? "Following the newest changes" : "Looking back"}
								</Badge>
								{page.isPlaceholderData && <Loader size="xs" />}
							</Group>
							<Text
								size="sm"
								mt={4}
							>
								{formatCount(changes.length)}{" "}
								{changes.length === 1 ? "change" : "changes"} after cursor{" "}
								{formatCount(view.requested_after_cursor)}, through cursor{" "}
								{formatCount(view.through_cursor)}. The newest change in the engine
								is at cursor {formatCount(view.head_cursor)}.
							</Text>
							<Text
								size="xs"
								c="dimmed"
							>
								The engine proved this page with {view.validation_method} (
								{formatCount(view.change_reads)} change reads,{" "}
								{formatCount(view.proof_nodes)} proof nodes).
							</Text>
						</Box>
						<Group gap="xs">
							<Button
								variant="light"
								size="xs"
								disabled={view.requested_after_cursor === 0}
								onClick={() =>
									setStart({
										sessionKey,
										after: Math.max(0, view.requested_after_cursor - PAGE),
									})
								}
							>
								Load older changes
							</Button>
							<Button
								variant="light"
								size="xs"
								disabled={!view.has_more}
								onClick={() => setStart({ sessionKey, after: view.through_cursor })}
							>
								Load newer changes
							</Button>
							<Button
								variant="light"
								size="xs"
								disabled={following}
								onClick={() => setStart(null)}
							>
								Follow the newest
							</Button>
						</Group>
					</Group>
					{changes.length === 0 ? (
						<Text size="sm">
							The engine returned zero changes after cursor{" "}
							{formatCount(view.requested_after_cursor)}.
						</Text>
					) : (
						<>
							<Paper
								withBorder
								p="md"
							>
								<Group
									wrap="nowrap"
									align="center"
								>
									<Button
										variant="default"
										size="xs"
										disabled={index <= 0}
										onClick={() => pick(index - 1)}
									>
										Step back
									</Button>
									<Box flex={1}>
										{changes.length > 1 ? (
											<Slider
												aria-label="Position in the change log"
												min={0}
												max={changes.length - 1}
												step={1}
												value={index}
												onChange={pick}
												label={(at) =>
													`cursor ${formatCount(changes[at]?.cursor)}`
												}
											/>
										) : (
											<Text
												size="sm"
												ta="center"
											>
												One change on this page
											</Text>
										)}
									</Box>
									<Button
										variant="default"
										size="xs"
										disabled={index >= changes.length - 1}
										onClick={() => pick(index + 1)}
									>
										Step forward
									</Button>
								</Group>
							</Paper>
							{current && (
								<ChangeDetail
									change={current}
									onOpenRecord={(record) => {
										onSelect(record);
										openLens("records");
									}}
								/>
							)}
							<ScrollArea.Autosize mah={420}>
								<Table
									highlightOnHover
									stickyHeader
								>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>Cursor</Table.Th>
											<Table.Th>When</Table.Th>
											<Table.Th>What happened</Table.Th>
											<Table.Th>What it touched</Table.Th>
											<Table.Th>Who</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{changes.map((change, at) => (
											<Table.Tr
												key={change.cursor}
												aria-selected={at === index}
												bg={
													at === index
														? "var(--mantine-primary-color-light)"
														: undefined
												}
												style={{ cursor: "pointer" }}
												onClick={() => pick(at)}
											>
												<Table.Td>
													<Button
														variant="subtle"
														size="compact-sm"
														ff="monospace"
														onClick={() => pick(at)}
													>
														{formatCount(change.cursor)}
													</Button>
												</Table.Td>
												<Table.Td>{formatTime(change.at_unix_ms)}</Table.Td>
												<Table.Td>{change.mutation.operation}</Table.Td>
												<Table.Td>
													<Text
														ff="monospace"
														size="sm"
														style={{ overflowWrap: "anywhere" }}
													>
														{change.mutation.target}
													</Text>
												</Table.Td>
												<Table.Td>{change.actor}</Table.Td>
											</Table.Tr>
										))}
									</Table.Tbody>
								</Table>
							</ScrollArea.Autosize>
						</>
					)}
				</>
			)}
		</Stack>
	);
}
