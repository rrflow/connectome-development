import {
	Alert,
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
} from "@mantine/core";
import { useMemo, useState } from "react";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import type { RrdAuditRecordView } from "~/rrflow/session";
import { iconErrorCircle, iconRefresh } from "~/shared/assets/icons";
import { useProject } from "../project/context";
import { formatCount, formatTime } from "../utils/format";
import { AUDIT_REFRESH_MS, useAuditTrail } from "./audit-trail";

/** Entries added to the table each time more are asked for. */
const SHOWN_STEP = 200;

const DECISION: Record<RrdAuditRecordView["decision"], { label: string; color: string }> = {
	allowed: { label: "Allowed", color: "green" },
	denied: { label: "Refused", color: "red" },
	failed: { label: "Failed", color: "orange" },
};

const PHASE: Record<RrdAuditRecordView["phase"], string> = {
	authorized: "Permission checked",
	completed: "Finished",
};

const words = (value: string) => value.replaceAll("_", " ");

/** The engine's audit log: who asked it to do what, and when, newest first. */
export function ActivityView() {
	const { session, client, sessionKey } = useProject();
	const { trail, older } = useAuditTrail(client, sessionKey, Boolean(session));
	const [shown, setShown] = useState(SHOWN_STEP);

	const windows = older.data?.pages;
	const records = useMemo(() => {
		const newestFirst = [...(trail.data?.records ?? [])].reverse();
		for (const window of windows ?? []) {
			newestFirst.push(...[...window.records].reverse());
		}
		return newestFirst;
	}, [trail.data, windows]);

	if (!session) return null;

	const view = trail.data;
	// The lowest journal position read so far; zero is the start of the log.
	const reachedBack = windows?.at(-1)?.after ?? view?.floor;
	const moreOnEngine = reachedBack !== undefined && reachedBack > 0;
	const showOlder = () => {
		if (shown >= records.length && moreOnEngine) older.fetchNextPage();
		setShown((count) => count + SHOWN_STEP);
	};

	return (
		<Stack gap="lg">
			<Group
				justify="space-between"
				align="flex-start"
			>
				<Box flex={1}>
					<PrimaryTitle>Activity</PrimaryTitle>
					<Text mt={4}>
						The engine keeps a log of every request it receives: who asked, what they
						asked for, and whether it was allowed. Newest entries are at the top, and
						the list refreshes every {AUDIT_REFRESH_MS / 1000} seconds. Reading this log
						is itself a request, so each refresh adds its own entries.
					</Text>
				</Box>
				<Button
					variant="light"
					size="xs"
					leftSection={<Icon path={iconRefresh} />}
					loading={trail.isFetching}
					onClick={() => trail.refetch()}
				>
					Refresh
				</Button>
			</Group>

			{trail.isPending && (
				<Group>
					<Loader size="sm" />
					<Text c="slate">Reading the engine's activity log…</Text>
				</Group>
			)}
			{trail.isError && (
				<Alert
					color="red"
					title={
						view
							? "The latest refresh failed; the entries below were read before it"
							: "The activity log could not be read"
					}
					icon={<Icon path={iconErrorCircle} />}
				>
					{describeRrdError(trail.error)}
				</Alert>
			)}
			{older.isError && (
				<Alert
					color="red"
					title="Older entries could not be read"
					icon={<Icon path={iconErrorCircle} />}
				>
					{describeRrdError(older.error)}
				</Alert>
			)}

			{view && reachedBack !== undefined && (
				<>
					<Text
						fz="sm"
						c="slate"
					>
						{formatCount(records.length)} {records.length === 1 ? "entry" : "entries"}{" "}
						read, from log position {formatCount(reachedBack)} through{" "}
						{formatCount(view.through)}. Last refreshed{" "}
						{formatTime(trail.dataUpdatedAt)}.
						{view.behind
							? " The engine is adding entries faster than one refresh reads, so the newest are not shown yet."
							: ""}
					</Text>
					{records.length === 0 ? (
						<Text c="slate">
							The engine returned zero log entries for these positions.
						</Text>
					) : (
						<Paper p="md">
							<ScrollArea>
								<Table
									fz="sm"
									striped
								>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>When</Table.Th>
											<Table.Th>Who</Table.Th>
											<Table.Th>What</Table.Th>
											<Table.Th>On what</Table.Th>
											<Table.Th>Outcome</Table.Th>
											<Table.Th>Position</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{records.slice(0, shown).map((record) => (
											<ActivityRow
												key={record.sequence}
												record={record}
											/>
										))}
									</Table.Tbody>
								</Table>
							</ScrollArea>
						</Paper>
					)}
					<Group>
						{(shown < records.length || moreOnEngine) && (
							<Button
								variant="light"
								size="xs"
								loading={older.isFetching}
								onClick={showOlder}
							>
								Show older entries
							</Button>
						)}
						<Text
							fz="sm"
							c="slate"
						>
							Showing {formatCount(Math.min(shown, records.length))} of the{" "}
							{formatCount(records.length)} read.
							{moreOnEngine ? "" : " This reaches the start of the log."}
						</Text>
					</Group>
				</>
			)}
		</Stack>
	);
}

function ActivityRow({ record }: { record: RrdAuditRecordView }) {
	const decision = DECISION[record.decision];

	return (
		<Table.Tr>
			<Table.Td style={{ whiteSpace: "nowrap" }}>{formatTime(record.at_unix_ms)}</Table.Td>
			<Table.Td>
				{record.principal === null ? (
					<Text
						fz="sm"
						c="dimmed"
					>
						No identity recorded
					</Text>
				) : (
					<Text
						fz="sm"
						ff="monospace"
						style={{ overflowWrap: "anywhere" }}
					>
						{record.principal}
					</Text>
				)}
			</Table.Td>
			<Table.Td title={`Operation ${record.operation_id} · request ${record.request_id}`}>
				{words(record.action)}
			</Table.Td>
			<Table.Td
				ff="monospace"
				maw={360}
				style={{ overflowWrap: "anywhere" }}
			>
				{record.resource}
			</Table.Td>
			<Table.Td>
				<Group
					gap={6}
					wrap="nowrap"
				>
					<Badge
						variant="light"
						color={decision.color}
					>
						{decision.label}
					</Badge>
					<Text
						fz="xs"
						c="slate"
						style={{ whiteSpace: "nowrap" }}
					>
						{PHASE[record.phase]} · status {record.status_code}
					</Text>
				</Group>
			</Table.Td>
			<Table.Td ff="monospace">{formatCount(record.sequence)}</Table.Td>
		</Table.Tr>
	);
}
