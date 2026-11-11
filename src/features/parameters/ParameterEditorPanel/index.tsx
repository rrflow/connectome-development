import { EditorView } from "@codemirror/view";
import { Alert, Badge, Box, Stack } from "@mantine/core";
import { useMemo, useState } from "react";
import type { Updater } from "use-immer";
import { CodeEditor } from "~/components/CodeEditor";
import { Icon } from "~/components/Icon";
import { ContentPane } from "~/components/Pane";
import { rrflowqlLinting } from "~/editor/languages/rrflowql";
import { rrflowqlTableCompletion } from "~/editor/languages/tables";
import { useStable } from "~/hooks/state/stable";
import { useDatabaseVersionLinter } from "~/hooks/ui/editor";
import { iconTune, iconWarning } from "~/shared/assets/icons";
import type { SchemaParameter } from "~/shared/types";
import { rrflowql } from "~/vendor/rrflowql-editor";

export interface ParameterEditorPanelProps {
	details: SchemaParameter;
	error: string;
	isCreating: boolean;
	onChange: Updater<SchemaParameter>;
}

export function ParameterEditorPanel({
	details,
	error,
	isCreating,
	onChange,
}: ParameterEditorPanelProps) {
	const [editor, setEditor] = useState<EditorView | null>(null);
	const rrflowqlVersion = useDatabaseVersionLinter(editor);

	const extensions = useMemo(
		() => [rrflowql(), rrflowqlVersion, rrflowqlLinting(), rrflowqlTableCompletion()],
		[rrflowqlVersion],
	);

	const handleChange = useStable((value: string) => {
		onChange((draft: any) => {
			draft.value = value;
		});
	});

	return (
		<ContentPane
			title="Value Editor"
			icon={iconTune}
			infoSection={
				isCreating && (
					<Badge
						ml="xs"
						variant="light"
					>
						Creating
					</Badge>
				)
			}
		>
			<Stack
				h="100%"
				flex={1}
				gap={0}
			>
				{error && (
					<Alert
						icon={<Icon path={iconWarning} />}
						color="red.5"
						mb="xl"
						style={{
							whiteSpace: "pre-wrap",
						}}
					>
						{error}
					</Alert>
				)}
				<Box
					flex={1}
					pos="relative"
				>
					<CodeEditor
						inset={0}
						pos="absolute"
						value={details.value}
						autoFocus
						lineNumbers={true}
						onMount={setEditor}
						onChange={handleChange}
						extensions={extensions}
					/>
				</Box>
			</Stack>
		</ContentPane>
	);
}
