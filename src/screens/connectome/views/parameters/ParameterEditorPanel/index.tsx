import { Alert, Badge, Box, Stack } from "@mantine/core";
import { useMemo } from "react";
import type { Updater } from "use-immer";
import { CodeEditor } from "~/components/CodeEditor";
import { ContentPane } from "~/components/Pane";
import { rrflowqlLinting } from "~/editor/rrflowql";
import { rrflowqlTableCompletion } from "~/editor/tables";
import { useStable } from "~/hooks/stable";
import type { SchemaParameter } from "~/types";
import { rrflowql } from "../../../../../rrflow/editor";
import { Icon, iconTune, iconWarning } from "../../../../../rrflow/ui/index";

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
	const extensions = useMemo(
		() => [rrflowql(), rrflowqlLinting(), rrflowqlTableCompletion()],
		[],
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
						onChange={handleChange}
						extensions={extensions}
					/>
				</Box>
			</Stack>
		</ContentPane>
	);
}
