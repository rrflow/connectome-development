import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import type { Conflict } from "./use-knowledge-draft";

export interface ConflictAlertProps {
	conflict: Conflict;
	onKeepMine: () => void;
	onTakeSaved: () => void;
}

/** Shown when the saved catalogue moved on and both sides changed the same fields. */
export function ConflictAlert({ conflict, onKeepMine, onTakeSaved }: ConflictAlertProps) {
	return (
		<Alert
			color="yellow"
			title="The saved version has changed"
		>
			<Stack gap="xs">
				<Text fz="sm">
					Your draft is kept. Choose which changes to keep before saving. Changed fields:{" "}
					{conflict.conflicts.join("; ")}.
				</Text>
				<Group>
					<Button
						variant="light"
						onClick={onKeepMine}
					>
						Keep my edits and review
					</Button>
					<Button
						variant="subtle"
						onClick={onTakeSaved}
					>
						Use saved version and discard my draft
					</Button>
				</Group>
			</Stack>
		</Alert>
	);
}
