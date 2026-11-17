import { Prec } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";
import { useEffect, useMemo, useState } from "react";
import { CodeEditor } from "~/components/CodeEditor";
import { useStable } from "~/hooks/state/stable";
import { rrflowql, showRefusal } from "~/rrflow/editor";
import { queryRefusal } from "~/rrflow/session";
import classes from "../style.module.scss";

export interface QueryEditorProps {
	query: string;
	onChange: (query: string) => void;
	onRun: () => void;
	/** The query the last run sent, and how that run failed. */
	refused: string | undefined;
	error: unknown;
}

/**
 * The rrflowQL editor. The engine's refusal of the query a run sent shows on
 * the word the engine names, for as long as the editor holds that query.
 */
export function QueryEditor({ query, onChange, onRun, refused, error }: QueryEditorProps) {
	const [editor, setEditor] = useState<EditorView | null>(null);
	const run = useStable(onRun);
	const extensions = useMemo(
		() => [
			rrflowql(),
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
	const refusal = queryRefusal(error);
	useEffect(() => {
		if (editor) {
			showRefusal(editor, refusal && refused === query ? { query, refusal } : null);
		}
	}, [editor, refusal, refused, query]);
	return (
		<CodeEditor
			className={classes.queryEditor}
			value={query}
			onChange={onChange}
			onMount={setEditor}
			extensions={extensions}
		/>
	);
}
