import { Alert, Box, Button, Group, Loader, Stack, Text } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import { queryRefusal, type RrdDatabaseView } from "~/rrflow/session";
import { iconErrorCircle, iconQuery } from "~/shared/assets/icons";
import { databaseQuery } from "../api/queries";
import { Term } from "../components/glossary";
import { useProject } from "../project/context";
import { QueryAnswer } from "./query-answer";
import { QueryEditor } from "./query-editor";
import { QueryRows } from "./query-rows";

/** Row bound for the starter queries; the engine's own query budget still applies. */
const STARTER_ROW_LIMIT = 50;
/** A source name the starter queries can spell without quoting. */
const PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

interface Starter {
	label: string;
	query: string;
}

/** Starter queries over the kinds this engine really holds, read from its schema. */
function starters(view: RrdDatabaseView | undefined): Starter[] {
	if (!view) return [];
	const at = `AT VALID ${Date.now()} KNOWN HEAD`;
	const table = view.tables.find(
		(entry) => entry.model === "relational" && PLAIN_NAME.test(entry.name),
	)?.name;
	const kind =
		table ?? view.graph.nodes.find((node) => PLAIN_NAME.test(node.kind))?.kind ?? undefined;
	const relation = view.tables.find(
		(entry) => entry.model === "graph_relation" && PLAIN_NAME.test(entry.name),
	)?.name;
	const list: Starter[] = [];
	if (kind) {
		list.push({
			label: `Read ${kind} records`,
			query: `FROM record:${kind} ${at} PROJECT * LIMIT ${STARTER_ROW_LIMIT}`,
		});
		list.push({
			label: `Read ${kind} records and analyse the run`,
			query: `FROM record:${kind} ${at} PROJECT * EXPLAIN ANALYZE`,
		});
	}
	if (relation) {
		list.push({
			label: `Read ${relation} relations`,
			query: `FROM relation:${relation} ${at} PROJECT * LIMIT ${STARTER_ROW_LIMIT}`,
		});
	}
	return list;
}

/** Why the engine refused a query: its parser's words when it gave them. */
function refusalText(error: unknown): string {
	return queryRefusal(error)?.reason ?? describeRrdError(error);
}

/** Type a query, run it, and see both the rows and how the engine chose to answer. */
export function QueryLabView() {
	const { session, client, sessionKey } = useProject();
	const database = useQuery({
		...databaseQuery(client, sessionKey),
		enabled: Boolean(session),
	});
	const [query, setQuery] = useState("");
	const execution = useMutation({
		mutationKey: ["rrd-query-lab", sessionKey],
		mutationFn: (text: string) => client.query(text),
	});

	if (!session) return null;

	const run = (text: string) => {
		if (text.trim()) execution.mutate(text);
	};
	const examples = starters(database.data);

	return (
		<Stack gap="xl">
			<Box>
				<PrimaryTitle fz={26}>Query lab</PrimaryTitle>
				<Text
					fz="lg"
					mt="xs"
				>
					Ask this project's engine a question in its <Term id="query">query</Term>{" "}
					language, rrflowQL. You get the rows it found and, underneath, how it decided to
					find them: the path it chose, the paths it turned down and why, and what the
					answer cost. Queries here only read; they never change the project.
				</Text>
			</Box>

			<Stack gap="sm">
				<QueryEditor
					query={query}
					onChange={setQuery}
					onRun={() => run(query)}
					refused={execution.variables}
					error={execution.error}
				/>
				<Group justify="space-between">
					<Group gap="xs">
						{database.isPending && <Loader size="xs" />}
						{database.isError && (
							<Text
								fz="xs"
								c="red"
							>
								Starter queries need the engine's schema, which could not be read:{" "}
								{describeRrdError(database.error)}
							</Text>
						)}
						{examples.map((example) => (
							<Button
								key={example.label}
								size="xs"
								variant="light"
								onClick={() => {
									setQuery(example.query);
									run(example.query);
								}}
							>
								{example.label}
							</Button>
						))}
						{database.data && examples.length === 0 && (
							<Text
								fz="xs"
								c="slate"
							>
								The engine's schema lists zero record kinds, so there is no starter
								query to offer.
							</Text>
						)}
						<Text
							fz="xs"
							c="slate"
						>
							Ctrl/⌘ + Enter runs the query.
						</Text>
					</Group>
					<Button
						size="xs"
						leftSection={<Icon path={iconQuery} />}
						loading={execution.isPending}
						disabled={!query.trim()}
						onClick={() => run(query)}
					>
						Run
					</Button>
				</Group>
				{execution.isError && (
					<Alert
						color="red"
						title="The engine refused this query"
						icon={<Icon path={iconErrorCircle} />}
					>
						{refusalText(execution.error)}
					</Alert>
				)}
				{execution.isPending && (
					<Group gap="xs">
						<Loader size="xs" />
						<Text
							fz="sm"
							c="slate"
						>
							Waiting for the engine's answer.
						</Text>
					</Group>
				)}
				{execution.data && <QueryRows result={execution.data} />}
			</Stack>

			{execution.data && <QueryAnswer result={execution.data} />}
		</Stack>
	);
}
