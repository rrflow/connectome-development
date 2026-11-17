import { Accordion, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { knowledgeDescendants } from "~/rrflow/knowledge";
import type { Removal } from "./use-knowledge-draft";

export interface TreeForm {
	id: string;
	name: string;
}

export interface TreeModalProps {
	form: TreeForm | null;
	onChange: (form: TreeForm | null) => void;
	onApply: (form: TreeForm) => void;
}

/** Names a new tree or renames one; applies to the draft only. */
export function TreeModal({ form, onChange, onApply }: TreeModalProps) {
	return (
		<Modal
			opened={form !== null}
			onClose={() => onChange(null)}
			title="Knowledge tree"
			centered
		>
			<Stack>
				<TextInput
					label="Tree name"
					autoFocus
					value={form?.name ?? ""}
					onChange={(event) => {
						const name = event.currentTarget.value;
						onChange(form ? { ...form, name } : null);
					}}
				/>
				<Text
					fz="sm"
					c="slate"
				>
					A tree collects related knowledge paths. Give it a name you will recognize.
				</Text>
				<Accordion variant="separated">
					<Accordion.Item value="identity">
						<Accordion.Control>Technical details</Accordion.Control>
						<Accordion.Panel>
							<Text
								fz="xs"
								style={{ overflowWrap: "anywhere" }}
							>
								Tree ID: {form?.id}
							</Text>
						</Accordion.Panel>
					</Accordion.Item>
				</Accordion>
				<Group justify="flex-end">
					<Button
						variant="subtle"
						onClick={() => onChange(null)}
					>
						Cancel
					</Button>
					<Button
						disabled={!form?.name.trim()}
						onClick={() => {
							if (!form) return;
							onApply(form);
							onChange(null);
						}}
					>
						Apply to draft
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

export interface RemoveModalProps {
	removal: Removal | null;
	onClose: () => void;
	onRemove: (removal: Removal) => void;
}

/** Confirms removing a tree or a path (with its descendants) from the draft. */
export function RemoveModal({ removal, onClose, onRemove }: RemoveModalProps) {
	const descendants = removal?.path
		? Math.max(0, knowledgeDescendants(removal.tree, removal.path.id).size - 1)
		: 0;
	return (
		<Modal
			opened={removal !== null}
			onClose={onClose}
			title="Remove from your trees?"
			centered
		>
			<Stack>
				<Text>
					{removal?.path
						? `Remove ${removal.path.name} and its ${descendants} descendant paths from this draft?`
						: `Remove ${removal?.tree.name} and all its registered paths from this draft?`}
				</Text>
				<Text
					fz="sm"
					c="slate"
				>
					The source data is kept. This removal takes effect when you save changes.
				</Text>
				<Group justify="flex-end">
					<Button
						variant="subtle"
						onClick={onClose}
					>
						Cancel
					</Button>
					<Button
						color="red"
						onClick={() => {
							if (!removal) return;
							onRemove(removal);
							onClose();
						}}
					>
						Remove from draft
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
