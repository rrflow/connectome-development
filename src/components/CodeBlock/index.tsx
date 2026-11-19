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
import { iconCheck, iconCopy } from "~/shared/assets/icons";
import classes from "./style.module.scss";

export interface CodeBlockProps extends Omit<PaperProps, "children" | "styles"> {
	/** The code to display. */
	value: string;
	/**
	 * rrflowQL, JSON and the languages in `./languages` are highlighted; any
	 * other name is shown as plain text.
	 */
	lang?: string;
	title?: string;
	withLineNumbers?: boolean;
	copyCodeProps?: ActionIconProps;
}

/** Languages already loaded, shared by every block, so later blocks colour from their first frame. */
const loaded = new Map<string, Extension | null>();

/**
 * Loads what colours `lang`, or null when nothing does. rrflowQL comes from
 * the one rrflowQL editor; every other language comes from `./languages`.
 * Both are loaded on demand: a page that shows only plain or JSON blocks, such
 * as the error dialog every RRFlow page can open, loads neither.
 */
async function loadLanguage(lang: string): Promise<Extension | null> {
	if (lang === "rrflowql") {
		return (await import("~/editor/rrflowql")).rrflowql();
	}
	const { CODE_LANGUAGES } = await import("./languages");
	return Object.hasOwn(CODE_LANGUAGES, lang) ? CODE_LANGUAGES[lang] : null;
}

/**
 * The highlighting extensions for `lang`. `ready` is false only while a
 * language is loading for the first time; a name nothing colours is shown as
 * plain text.
 */
function useLanguageExtension(lang: string | undefined) {
	const name = lang?.toLowerCase();
	const immediate = name === undefined || name === "json" || loaded.has(name);
	const [, setArrived] = useState(0);

	useEffect(() => {
		if (name === undefined || name === "json" || loaded.has(name)) {
			return;
		}

		let active = true;

		loadLanguage(name).then((language) => {
			loaded.set(name, language);
			if (active) {
				setArrived((count) => count + 1);
			}
		});

		return () => {
			active = false;
		};
	}, [name]);

	const language =
		name === undefined ? null : name === "json" ? null : (loaded.get(name) ?? null);
	const extensions = useMemo(
		() => (name === "json" ? [json()] : language ? [language] : []),
		[name, language],
	);

	return { extensions, ready: immediate };
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
