import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useMemo, useState } from "react";
import { CodeEditor } from "~/components/CodeEditor";
import {
	getQueryRange,
	layout,
	rrflowql,
	rrflowqlLinting,
	rrflowqlParameterCompletion,
	rrflowqlSourceCompletion,
	showRefusal,
} from "~/editor/rrflowql";
import { useSetting } from "~/hooks/app/config";
import { useStable } from "~/hooks/state/stable";
import { queryRefusal } from "~/rrflow/session";
import classes from "../style.module.scss";

export interface QueryEditorProps {
	query: string;
	onChange: (query: string) => void;
	onRun: () => void;
	/** The query the last run sent, and how that run failed. */
	refused: string | undefined;
	error: unknown;
	/** Hears the selected text, or an empty string when nothing is selected. */
	onSelection?: (selected: string) => void;
	/** Hears why the engine's tokenizer would refuse the text, or an empty string. */
	onValidity?: (reason: string) => void;
	/** The kinds the schema lists per source family, for completion. */
	kinds?: () => Record<string, string[]>;
	/** The parameter names that have a value, for completion. */
	parameters?: () => string[];
	onMount?: (editor: EditorView) => void;
}

/** Every selected range's text, one per line; a query is one statement. */
function selectedText(view: EditorView): string {
	return view.state.selection.ranges
		.filter((range) => !range.empty)
		.map((range) => view.state.sliceDoc(range.from, range.to))
		.join("\n");
}

/**
 * Lays out the selection, or the whole query when nothing is selected. Only
 * whitespace changes, so the engine reads the same query.
 */
export function formatQuery(view: EditorView): void {
	const { main } = view.state.selection;
	const [from, to] = main.empty ? [0, view.state.doc.length] : [main.from, main.to];
	const insert = layout(view.state.sliceDoc(from, to));
	view.dispatch({ changes: { from, to, insert } });
	view.focus();
}

/**
 * The rrflowQL editor. The engine's refusal of the query a run sent shows on
 * the word the engine names, for as long as the editor holds that query.
 */
export function QueryEditor({
	query,
	onChange,
	onRun,
	refused,
	error,
	onSelection,
	onValidity,
	kinds,
	parameters,
	onMount,
}: QueryEditorProps) {
	const [editor, setEditor] = useState<EditorView | null>(null);
	const [lineNumbers] = useSetting("appearance", "queryLineNumbers");
	const run = useStable(onRun);
	const selection = useStable((selected: string) => onSelection?.(selected));
	const validity = useStable((reason: string) => onValidity?.(reason));
	const kindsNow = useStable(() => kinds?.() ?? {});
	const parametersNow = useStable(() => parameters?.() ?? []);
	const mount = useStable((view: EditorView) => {
		setEditor(view);
		onMount?.(view);
	});
	const extensions = useMemo(
		() => [
			rrflowql(),
			rrflowqlLinting(validity),
			rrflowqlSourceCompletion(kindsNow),
			rrflowqlParameterCompletion(parametersNow),
			EditorView.updateListener.of((update) => {
				if (update.selectionSet || update.docChanged) selection(selectedText(update.view));
			}),
			// Above the base keymap, which inserts a blank line on Mod-Enter.
			Prec.highest(
				keymap.of([
					...["Mod-Enter", "Ctrl-Enter"].map((key) => ({
						key,
						run: () => {
							run();
							return true;
						},
					})),
					{
						key: "Mod-e",
						run: (view: EditorView) => {
							const range = getQueryRange(view);
							if (range) {
								view.dispatch({ selection: { anchor: range[0], head: range[1] } });
							}
							return true;
						},
					},
				]),
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
			onMount={mount}
			extensions={extensions}
			lineNumbers={lineNumbers}
		/>
	);
}
