import { json } from "@codemirror/lang-json";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
	ActionIcon,
	type ActionIconProps,
	Box,
	Group,
	Paper,
	type PaperProps,
	Text,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";
import { CodeEditor } from "~/components/CodeEditor";
import { Icon } from "~/components/Icon";
import { iconCheck, iconCopy } from "~/icons";
import classes from "./style.module.scss";

export interface CodeBlockProps extends Omit<PaperProps, "children" | "styles"> {
	/** The code to display. */
	value: string;
	/** `rrflowql` or `json` are highlighted; any other language is shown as plain text. */
	lang?: string;
	title?: string;
	withLineNumbers?: boolean;
	copyCodeProps?: ActionIconProps;
}

/** The inherited RRFlowQL language once loaded, shared by every block. */
let loadedRrflowql: (() => Extension) | null = null;

/**
 * The highlighting extensions for `lang`. The RRFlowQL language is still the
 * inherited editor's (sprint 009 Slice D3 replaces it), so it is loaded on
 * demand: a page that shows only plain or JSON blocks, such as the error
 * dialog every RRFlow page can open, never loads the inherited editor. Once
 * loaded it is kept, so later blocks are highlighted from their first frame.
 * `ready` is false only while an RRFlowQL block waits for that first load.
 */
function useLanguageExtension(lang: string | undefined) {
	const [rrflowql, setRrflowql] = useState<(() => Extension) | null>(() => loadedRrflowql);

	useEffect(() => {
		if (lang !== "rrflowql" || rrflowql) {
			return;
		}

		let active = true;

		import("~/vendor/rrflowql-editor").then((editor) => {
			loadedRrflowql = editor.rrflowql;
			if (active) {
				setRrflowql(() => editor.rrflowql);
			}
		});

		return () => {
			active = false;
		};
	}, [lang, rrflowql]);

	const extensions = useMemo(() => {
		switch (lang) {
			case "rrflowql":
				return rrflowql ? [rrflowql()] : [];
			case "json":
				return [json()];
			default:
				return [];
		}
	}, [lang, rrflowql]);

	return { extensions, ready: lang !== "rrflowql" || rrflowql !== null };
}

/**
 * A read-only, highlighted block of code with a copy button, built on the
 * same CodeMirror setup as the editors so it reads the same.
 */
export function CodeBlock({
	value,
	lang,
	title,
	withLineNumbers,
	copyCodeProps,
	className,
	...other
}: CodeBlockProps) {
	const clipboard = useClipboard({ timeout: 1200 });
	const language = useLanguageExtension(lang);

	const extensions = useMemo(
		() => [...language.extensions, EditorView.lineWrapping, EditorView.editable.of(false)],
		[language.extensions],
	);

	return (
		<Paper
			className={[classes.root, className ?? ""].join(" ").trim()}
			p={0}
			{...other}
		>
			{title && (
				<Group
					className={classes.header}
					px="sm"
					py={6}
				>
					<Text
						fz="xs"
						fw={600}
						c="bright"
					>
						{title}
					</Text>
				</Group>
			)}
			<Box className={classes.body}>
				<CodeEditor
					// CodeEditor rebuilds its state without the document when its
					// extensions change, so the block remounts once the language
					// arrives instead of changing them in place.
					key={language.ready ? "ready" : "pending"}
					className={classes.editor}
					value={value}
					extensions={extensions}
					lineNumbers={withLineNumbers}
					readOnly
				/>
				<ActionIcon
					className={classes.copy}
					variant="subtle"
					color="obsidian"
					size="sm"
					aria-label={clipboard.copied ? "Copied" : "Copy code"}
					onClick={() => clipboard.copy(value)}
					{...copyCodeProps}
				>
					<Icon
						path={clipboard.copied ? iconCheck : iconCopy}
						size="sm"
					/>
				</ActionIcon>
			</Box>
		</Paper>
	);
}
