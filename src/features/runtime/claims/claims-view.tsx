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
	TextInput,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import { queryRefusal, type RrdQueryRowView } from "~/rrflow/session";
import { iconErrorCircle, iconRefresh } from "~/shared/assets/icons";
import { plural } from "~/shared/util/text/helpers";
import { busyRetry } from "../api/queries";
import { Term } from "../components/glossary";
import { ReadNotice } from "../components/notice";
import { useProject } from "../project/context";
import { formatCount, formatTime } from "../utils/format";

/** A predicate the query can spell after `claim:` without quoting. */
const PLAIN_PREDICATE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
/** Widest cell before truncation; the full value shows on hover. */
const CELL_WIDTH = 360;
const CELL_STYLE = { overflow: "hidden", textOverflow: "ellipsis" } as const;

/** The claim columns this view names in plain words, in reading order. */
const KNOWN_COLUMNS: { column: string; label: string; time?: boolean }[] = [
	{ column: "subject", label: "About" },
	{ column: "predicate", label: "Says" },
	{ column: "object", label: "Value" },
	{ column: "valid_from", label: "True from", time: true },
	{ column: "valid_to", label: "True until", time: true },
	{ column: "tx_time", label: "Recorded", time: true },
	{ column: "actor", label: "Stated by" },
];

/** Every claim as the engine holds it now, or those of one predicate. */
function claimsQuery(predicate: string): string {
	const source = predicate ? `claim:${predicate}` : "claim";
	return `FROM ${source} AT VALID ${Date.now()} KNOWN HEAD PROJECT *`;
}

/** A millisecond instant the engine returned, as a local date and time. */
function instant(value: string | undefined): { text: string; title?: string } {
	if (value === undefined) return { text: "" };
	if (value === "null") return { text: "no end recorded", title: "null" };
	const ms = Number(value);
	return Number.isSafeInteger(ms) && ms > 0
		? { text: formatTime(ms), title: `${value} ms` }
		: { text: value };
}

function cell(row: RrdQueryRowView, column: string, time: boolean | undefined) {
	const value = row.values[column];
	return time ? instant(value) : { text: value ?? "", title: value };
}

/** The statements the engine holds as true right now, each with when it holds. */
export function ClaimsView() {
	const { session, client, sessionKey } = useProject();
	const [draft, setDraft] = useState("");
	const [predicate, setPredicate] = useState("");
	const claims = useQuery({
		queryKey: ["rrd-claims", sessionKey, predicate],
		queryFn: () => client.query(claimsQuery(predicate)),
		enabled: Boolean(session),
		...busyRetry,
	});

	if (!session) return null;

	const wanted = draft.trim();
	const draftValid = wanted === "" || PLAIN_PREDICATE.test(wanted);
	const result = claims.data;
	const named = KNOWN_COLUMNS.filter((entry) => result?.columns.includes(entry.column));
	const others =
		result?.columns.filter(
			(column) => !KNOWN_COLUMNS.some((entry) => entry.column === column),
		) ?? [];

	return (
		<Stack gap="xl">
			<Box>
				<PrimaryTitle fz={26}>Claims</PrimaryTitle>
				<Text
					fz="lg"
					mt="xs"
				>
					A claim is one statement the engine holds about something: what it is about,
					what it says, and the period it is true for. This list is what the engine holds
					as true at this moment, read at its latest <Term id="cursor">cursor</Term>. When
					a statement was replaced, only the one in force now is listed.
				</Text>
			</Box>

			<Group align="flex-end">
				<TextInput
					label="Only claims that say"
					description="A predicate name, such as the one in the Says column. Leave empty for every claim."
					value={draft}
					onChange={(event) => setDraft(event.currentTarget.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && draftValid) setPredicate(wanted);
					}}
					error={
						draftValid
							? undefined
							: "A predicate is letters, digits, underscores, dots and dashes"
					}
					w={360}
				/>
				<Button
					variant="light"
					disabled={!draftValid || wanted === predicate}
					onClick={() => setPredicate(wanted)}
				>
					Show
				</Button>
				<Button
					variant="light"
					leftSection={<Icon path={iconRefresh} />}
					loading={claims.isFetching}
					onClick={() => claims.refetch()}
				>
					Read again
				</Button>
			</Group>

			<ReadNotice query={claims} />

			{claims.isPending && (
				<Stack align="center">
					<Loader />
					<Text c="slate">Asking the engine for its claims.</Text>
				</Stack>
			)}

			{claims.isError && !result && (
				<Alert
					color="red"
					title="The engine did not return its claims"
					icon={<Icon path={iconErrorCircle} />}
				>
					{queryRefusal(claims.error)?.reason ?? describeRrdError(claims.error)}
				</Alert>
			)}

			{result && (
				<Paper p="md">
					<Group
						gap="xs"
						mb="sm"
					>
						<Badge variant="light">
							{formatCount(result.returned_rows)}{" "}
							{plural(result.returned_rows, "claim")}
						</Badge>
						<Badge variant="outline">
							cursor {formatCount(result.known_at_cursor)}
						</Badge>
						{result.truncated && (
							<Badge color="orange">
								truncated: the engine holds more than it returned
							</Badge>
						)}
					</Group>
					<Text
						ff="monospace"
						fz="xs"
						c="slate"
						mb="sm"
						title="The query the engine answered"
					>
						{result.canonical_query}
					</Text>
					{result.rows.length === 0 ? (
						<Text c="slate">
							{predicate
								? `The engine returned zero claims that say "${predicate}".`
								: "The engine returned zero claims for this project."}
						</Text>
					) : (
						<ScrollArea.Autosize
							mah={640}
							type="auto"
						>
							<Table
								fz="sm"
								striped
								stickyHeader
								style={{ whiteSpace: "nowrap" }}
							>
								<Table.Thead>
									<Table.Tr>
										{named.map((entry) => (
											<Table.Th
												key={entry.column}
												title={entry.column}
											>
												{entry.label}
											</Table.Th>
										))}
										{others.map((column) => (
											<Table.Th key={column}>{column}</Table.Th>
										))}
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{result.rows.map((row) => (
										<Table.Tr
											key={row.identity}
											title={row.identity}
										>
											{[
												...named,
												...others.map((column) => ({
													column,
													time: false,
												})),
											].map((entry) => {
												const shown = cell(row, entry.column, entry.time);
												return (
													<Table.Td
														key={entry.column}
														maw={CELL_WIDTH}
														title={shown.title}
														style={CELL_STYLE}
													>
														{shown.text}
													</Table.Td>
												);
											})}
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</ScrollArea.Autosize>
					)}
				</Paper>
			)}
		</Stack>
	);
}
