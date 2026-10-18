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
import { useMemo } from "react";
import { CodeEditor } from "~/components/CodeEditor";
import { Icon } from "~/components/Icon";
import { iconCheck, iconCopy } from "~/icons";
import { rrflowql } from "~/vendor/rrflowql-editor";
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

function languageExtension(lang: string | undefined): Extension[] {
	switch (lang) {
		case "rrflowql":
			return [rrflowql()];
		case "json":
			return [json()];
		default:
			return [];
	}
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

	const extensions = useMemo(
		() => [...languageExtension(lang), EditorView.lineWrapping, EditorView.editable.of(false)],
		[lang],
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
