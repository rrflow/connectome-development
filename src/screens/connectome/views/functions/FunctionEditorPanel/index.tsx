import { Alert, Badge, Box, Group, Stack } from "@mantine/core";
import { useMemo } from "react";
import type { Updater } from "use-immer";
import { adapter } from "~/adapter";
import { ActionButton } from "~/components/ActionButton";
import { CodeEditor } from "~/components/CodeEditor";
import { ContentPane } from "~/components/Pane";
import { RRFLOWQL_FILTER } from "~/constants";
import {
	rrflowqlCustomFunctionCompletion,
	rrflowqlLinting,
	rrflowqlTableCompletion,
	rrflowqlVariableCompletion,
} from "~/editor";
import { useSetting } from "~/hooks/config";
import { useStable } from "~/hooks/stable";
import { getRRFlowQL } from "~/screens/connectome/connection/connection";
import { showErrorNotification } from "~/shared/util/helpers";
import { buildFunctionDefinition } from "~/shared/util/schema";
import type { FunctionDetails, SchemaFunction } from "~/types";
import { rrflowql } from "../../../../../rrflow/editor";
import {
	Icon,
	iconDownload,
	iconJSON,
	iconText,
	iconWarning,
} from "../../../../../rrflow/ui/index";

export interface FunctionEditorPanelProps {
	details: SchemaFunction;
	error: string;
	isCreating: boolean;
	onChange: Updater<FunctionDetails>;
}

export function FunctionEditorPanel({
	details,
	error,
	isCreating,
	onChange,
}: FunctionEditorPanelProps) {
	const [hasLineNumbers] = useSetting("appearance", "functionLineNumbers");

	const downloadBody = useStable(() => {
		adapter.saveFile(`Save function`, `${details.name}.rrflowql`, [RRFLOWQL_FILTER], () =>
			buildFunctionDefinition(details),
		);
	});

	const formatFunction = useStable(async () => {
		const isFunctionBlockInvalid = await getRRFlowQL().validateQuery(details.block);
		if (isFunctionBlockInvalid) {
			showErrorNotification({
				title: "Failed to format",
				content: "Your function must be valid to format it",
			});
			return;
		}
		const formattedFunctionBlock = await getRRFlowQL().formatQuery(details.block);
		onChange((draft) => {
			(draft.details as SchemaFunction).block = formattedFunctionBlock;
		});
	});

	const resolveVariables = useStable(() => {
		return details.args.flatMap(([name]) => name);
	});

	const handleChange = useStable((value: string) => {
		onChange((draft: any) => {
			(draft.details as SchemaFunction).block = value;
		});
	});

	const extensions = useMemo(
		() => [
			rrflowql(),
			rrflowqlLinting(),
			rrflowqlVariableCompletion(resolveVariables),
			rrflowqlCustomFunctionCompletion(),
			rrflowqlTableCompletion(),
		],
		[],
	);

	return (
		<ContentPane
			title="Source Editor"
			icon={iconJSON}
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
			rightSection={
				<Group>
					<ActionButton
						label="Download function"
						onClick={downloadBody}
					>
						<Icon path={iconDownload} />
					</ActionButton>
					<ActionButton
						label="Format function"
						onClick={formatFunction}
					>
						<Icon path={iconText} />
					</ActionButton>
				</Group>
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
						value={details.block}
						autoFocus
						lineNumbers={hasLineNumbers}
						onChange={handleChange}
						extensions={extensions}
					/>
				</Box>
			</Stack>
		</ContentPane>
	);
}
