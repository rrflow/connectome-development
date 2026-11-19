import type { EditorView } from "@codemirror/view";
import { Alert, Box, Button, Group, Loader, Stack, Text } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { useSetting } from "~/hooks/app/config";
import {
	inferParameters,
	parseParameters,
	type QueryParameters,
	sourceKinds,
} from "~/rrflow/client/query-parameters";
import { describeRrdError } from "~/rrflow/runtime";
import { queryRefusal } from "~/rrflow/session";
import {
	iconBraces,
	iconErrorCircle,
	iconQuery,
	iconText,
	iconVariable,
} from "~/shared/assets/icons";
import { databaseQuery } from "../api/queries";
import { Term } from "../components/glossary";
import { formatQuery, QueryEditor } from "../components/query-editor";
import { useProject } from "../project/context";
import { QueryAnswer } from "./query-answer";
import { QueryRows } from "./query-rows";
import { QueryVariables } from "./query-variables";
import { starters } from "./starters";

interface Run {
	text: string;
	parameters: QueryParameters;
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
	const [runSelection] = useSetting("behavior", "querySelectionExecution");
	const [warnSelection] = useSetting("behavior", "querySelectionExecutionWarning");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState("");
	const [lexical, setLexical] = useState("");
	const [variables, setVariables] = useState("");
	const [showVariables, setShowVariables] = useState(false);
	const [editor, setEditor] = useState<EditorView | null>(null);
	const parsed = useMemo(() => parseParameters(variables), [variables]);
	const kinds = useMemo(() => sourceKinds(database.data?.tables ?? []), [database.data]);
	const execution = useMutation({
		mutationKey: ["rrd-query-lab", sessionKey],
		mutationFn: async ({ text, parameters }: Run) => {
			const started = performance.now();
			const result = await client.query(text, parameters);
			return { result, roundTripMs: performance.now() - started };
		},
	});

	if (!session) return null;

	const selection = runSelection && selected.trim() ? selected : "";
	const run = (text: string) => {
		if (text.trim() && parsed.ok) execution.mutate({ text, parameters: parsed.parameters });
	};
	const runEditor = () => run(selection || query);
	const infer = () => {
		const next = inferParameters(variables, query);
		if (next !== null) setVariables(next);
		setShowVariables(true);
	};
	const examples = starters(database.data);
	const answer = execution.data;

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
					onRun={runEditor}
					refused={execution.variables?.text}
					error={execution.error}
					onSelection={setSelected}
					onValidity={setLexical}
					kinds={() => kinds}
					parameters={() => (parsed.ok ? Object.keys(parsed.parameters) : [])}
					onMount={setEditor}
				/>
				{showVariables && (
					<QueryVariables
						text={variables}
						parsed={parsed}
						onChange={setVariables}
						onRun={runEditor}
						onClear={() => setVariables("")}
						onClose={() => setShowVariables(false)}
					/>
				)}
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
							Ctrl/⌘ + Enter runs the query; Ctrl/⌘ + E selects it.
						</Text>
					</Group>
					<Group gap="xs">
						<Button
							size="xs"
							variant="subtle"
							leftSection={<Icon path={iconText} />}
							disabled={!query.trim() || !editor}
							onClick={() => editor && formatQuery(editor)}
						>
							{selected.trim() ? "Format selection" : "Format"}
						</Button>
						<Button
							size="xs"
							variant="subtle"
							leftSection={<Icon path={iconBraces} />}
							disabled={!query.trim()}
							onClick={infer}
						>
							Infer variables
						</Button>
						<Button
							size="xs"
							variant={showVariables ? "light" : "subtle"}
							leftSection={<Icon path={iconVariable} />}
							onClick={() => setShowVariables((shown) => !shown)}
						>
							Variables
							{parsed.ok && Object.keys(parsed.parameters).length > 0
								? ` (${Object.keys(parsed.parameters).length})`
								: ""}
						</Button>
						<Button
							size="xs"
							color={lexical ? "red" : undefined}
							variant={lexical ? "light" : "filled"}
							title={
								lexical
									? `The engine's tokenizer would refuse this: ${lexical}`
									: undefined
							}
							leftSection={<Icon path={iconQuery} />}
							loading={execution.isPending}
							disabled={!query.trim() || !parsed.ok}
							onClick={runEditor}
						>
							{selection ? "Run selection" : "Run"}
						</Button>
					</Group>
				</Group>
				{selection && warnSelection && (
					<Text
						fz="xs"
						c="orange"
					>
						Only the highlighted selection will run. Change this under Settings,
						Behaviour.
					</Text>
				)}
				{!parsed.ok && (
					<Alert
						color="red"
						title="The variables cannot be read, so the query will not run"
						icon={<Icon path={iconErrorCircle} />}
					>
						{parsed.error}
					</Alert>
				)}
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
				{answer && (
					<QueryRows
						result={answer.result}
						roundTripMs={answer.roundTripMs}
					/>
				)}
			</Stack>

			{answer && <QueryAnswer result={answer.result} />}
		</Stack>
	);
}
