import { json } from "@codemirror/lang-json";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { CodeEditor } from "~/components/CodeEditor";
import { useStable } from "~/hooks/state/stable";
import type { ParsedParameters } from "~/rrflow/client/query-parameters";
import classes from "../style.module.scss";

export interface QueryVariablesProps {
	text: string;
	parsed: ParsedParameters;
	onChange: (text: string) => void;
	/** Runs the query these values belong to. */
	onRun: () => void;
	onClear: () => void;
	onClose: () => void;
}

/**
 * The values a query's `$name` parameters stand for, as one JSON object. They
 * are sent with every run; the engine says which types it takes.
 */
export function QueryVariables({
	text,
	parsed,
	onChange,
	onRun,
	onClear,
	onClose,
}: QueryVariablesProps) {
	const run = useStable(onRun);
	const extensions = useMemo(
		() => [
			json(),
			// Above the base keymap, which inserts a blank line on Mod-Enter.
			Prec.highest(
				keymap.of(
					["Mod-Enter", "Ctrl-Enter"].map((key) => ({
						key,
						run: () => {
							run();
							return true;
						},
					})),
				),
			),
		],
		[],
	);
	return (
		<Paper p="sm">
			<Stack gap="xs">
				<Group justify="space-between">
					<Group gap="xs">
						<Text fw={600}>Variables</Text>
						{parsed.ok ? (
							<Badge variant="light">
								{Object.keys(parsed.parameters).length} sent with each run
							</Badge>
						) : (
							<Badge color="red">not sent: {parsed.error}</Badge>
						)}
					</Group>
					<Group gap="xs">
						<Button
							size="xs"
							variant="subtle"
							onClick={onClear}
						>
							Clear
						</Button>
						<Button
							size="xs"
							variant="subtle"
							onClick={onClose}
						>
							Close
						</Button>
					</Group>
				</Group>
				<CodeEditor
					className={classes.queryEditor}
					value={text}
					onChange={onChange}
					extensions={extensions}
				/>
				<Text
					fz="xs"
					c="slate"
				>
					One JSON object: each name is a parameter the query writes as $name. A whole
					number is sent unsigned when zero or more and as an integer when negative; write{" "}
					{'{ "type": "integer", "value": 5 }'} to choose the type yourself.
				</Text>
			</Stack>
		</Paper>
	);
}
