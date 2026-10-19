import { Badge, Group } from "@mantine/core";
import { useMemo } from "react";
import { ActionButton } from "~/components/ActionButton";
import { CodeEditor } from "~/components/CodeEditor";
import { ContentPane } from "~/components/Pane";
import { rrflowqlLinting } from "~/editor";
import { useConnection } from "~/hooks/connection";
import { useDebouncedFunction } from "~/hooks/debounce";
import { useConnectionAndView } from "~/hooks/routing";
import { getRRFlowQL } from "~/screens/connectome/connection/connection";
import { useConfigStore } from "~/shell/stores/config";
import { rrflowql } from "../../../../../rrflow/editor";
import { Icon, iconClose, iconDollar } from "../../../../../rrflow/ui/index";

export interface VariablesPaneProps {
	isValid: boolean;
	setIsValid: (isValid: boolean) => void;
	closeVariables: () => void;
}

export function VariablesPane(props: VariablesPaneProps) {
	const { updateConnection } = useConfigStore.getState();
	const [connection] = useConnectionAndView();
	const variablesText = useConnection((c) => c?.graphqlVariables ?? "");

	const setVariables = useDebouncedFunction(async (content: string | undefined) => {
		if (!connection) return;

		try {
			const json = content || "";
			const parsed = await getRRFlowQL().parseValue(json);

			if (typeof parsed !== "object" || Array.isArray(parsed)) {
				throw new TypeError("Must be object");
			}

			updateConnection({
				id: connection,
				graphqlVariables: content,
			});

			props.setIsValid(true);
		} catch {
			props.setIsValid(false);
		}
	}, 50);

	const extensions = useMemo(() => [rrflowql(), rrflowqlLinting()], []);

	return (
		<ContentPane
			title="Variables"
			icon={iconDollar}
			rightSection={
				<Group gap="xs">
					{!props.isValid && (
						<Badge
							color="red"
							variant="light"
						>
							Invalid syntax
						</Badge>
					)}
					<ActionButton
						color="obsidian"
						label="Close panel"
						onClick={props.closeVariables}
					>
						<Icon path={iconClose} />
					</ActionButton>
				</Group>
			}
		>
			<CodeEditor
				value={variablesText}
				onChange={setVariables}
				lineNumbers
				extensions={extensions}
			/>
		</ContentPane>
	);
}
