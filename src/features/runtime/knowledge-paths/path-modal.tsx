import {
	Accordion,
	Alert,
	Button,
	Group,
	Modal,
	Select,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { knowledgeParentOptions } from "~/rrflow/knowledge";
import type { RrdKnowledgePathView, RrdKnowledgeTreeView } from "~/rrflow/session";
import { errorText, externalBinding } from "./binding";
import { ExternalPathEditor } from "./external-path-editor";
import type { useKnowledgeDraft } from "./use-knowledge-draft";

export interface PathForm {
	treeId: string;
	path: RrdKnowledgePathView;
}

export interface PathModalProps {
	form: PathForm | null;
	/** The tree the path belongs to, for its group choices. */
	tree: RrdKnowledgeTreeView | undefined;
	vectors: ReturnType<typeof useKnowledgeDraft>["vectors"];
	error: string | null;
	onEdit: (change: Partial<RrdKnowledgePathView>) => void;
	onApply: () => void;
	onClose: () => void;
}

/** Adds or edits one path: where it sits, and what it points at. Applies to the draft only. */
export function PathModal({
	form,
	tree,
	vectors,
	error,
	onEdit,
	onApply,
	onClose,
}: PathModalProps) {
	const collections = vectors.data?.collections ?? [];
	const binding = form?.path.binding;
	const selected =
		binding?.kind === "native"
			? collections.find((collection) => collection.collection_id === binding.collection_id)
			: undefined;
	return (
		<Modal
			opened={form !== null}
			onClose={onClose}
			title="Knowledge path"
			size="lg"
			centered
		>
			{form && tree && (
				<Stack>
					<TextInput
						label="Path name"
						autoFocus
						value={form.path.name}
						onChange={(event) => onEdit({ name: event.currentTarget.value })}
					/>
					<Select
						label="Place inside a group"
						placeholder="Top of this tree"
						description="Leave empty to place this path at the top level."
						clearable
						searchable
						data={knowledgeParentOptions(tree, form.path.id).map((path) => ({
							value: path.id,
							label: path.name,
						}))}
						value={form.path.parent_id}
						onChange={(parent_id) => onEdit({ parent_id })}
					/>
					<Select
						label="What does this path contain?"
						value={form.path.binding.kind}
						data={[
							{ value: "group", label: "Group of paths" },
							{ value: "native", label: "RRFlow vectors · this engram" },
							{ value: "external", label: "External service · setup only" },
						]}
						onChange={(kind) => {
							if (kind === form.path.binding.kind) return;
							if (kind === "group") onEdit({ binding: { kind: "group" } });
							if (kind === "external") onEdit({ binding: externalBinding() });
							if (kind === "native")
								onEdit({
									binding: {
										kind: "native",
										collection_id: collections[0]?.collection_id ?? "",
										vector_name: collections[0]?.vectors[0]?.name ?? "",
									},
								});
						}}
					/>
					{form.path.binding.kind === "group" && (
						<Text
							fz="sm"
							c="slate"
						>
							Groups keep related paths together. Add source paths inside this group
							after saving it to your draft.
						</Text>
					)}
					{form.path.binding.kind === "native" && (
						<>
							{vectors.isPending && (
								<Text
									fz="sm"
									role="status"
								>
									Loading RRFlow vector sources…
								</Text>
							)}
							{vectors.isError && (
								<Alert
									color="yellow"
									title="Vector sources unavailable"
								>
									{errorText(vectors.error)}
									<Button
										variant="subtle"
										onClick={() => vectors.refetch()}
									>
										Retry sources
									</Button>
								</Alert>
							)}
							{vectors.isSuccess && collections.length === 0 && (
								<Alert
									color="blue"
									title="No RRFlow vector collections yet"
								>
									A native path needs a collection already stored in this engram.
									You can add groups or external service settings now.
								</Alert>
							)}
							{selected && selected.vectors.length === 0 && (
								<Alert
									color="blue"
									title="This collection has no vector fields"
								>
									Choose a collection with an existing vector field. If the engram
									changes, refresh the sources below.
								</Alert>
							)}
							<Select
								label="RRFlow collection"
								disabled={
									vectors.isPending || vectors.isError || collections.length === 0
								}
								searchable
								placeholder="Choose an existing collection"
								data={collections.map((collection) => ({
									value: collection.collection_id,
									label: collection.collection_id,
								}))}
								value={form.path.binding.collection_id}
								onChange={(collection_id) => {
									const collection = collections.find(
										(item) => item.collection_id === collection_id,
									);
									onEdit({
										binding: {
											kind: "native",
											collection_id: collection_id ?? "",
											vector_name: collection?.vectors[0]?.name ?? "",
										},
									});
								}}
							/>
							<Select
								label="Vector field"
								description={
									!selected
										? "Choose a RRFlow collection first to see its vector fields."
										: undefined
								}
								disabled={!selected || selected.vectors.length === 0}
								searchable
								placeholder="Choose a vector field"
								data={(selected?.vectors ?? []).map((vector) => ({
									value: vector.name,
									label: `${vector.name} · ${vector.dimensions} dimensions`,
								}))}
								value={form.path.binding.vector_name}
								onChange={(vector_name) => {
									if (form.path.binding.kind === "native")
										onEdit({
											binding: {
												...form.path.binding,
												vector_name: vector_name ?? "",
											},
										});
								}}
							/>
							<Text
								fz="sm"
								c="slate"
							>
								Use vectors already stored in this RRFlow engram. Saving the path
								only registers the reference; it does not import documents.
							</Text>
							<Button
								variant="subtle"
								size="xs"
								loading={vectors.isFetching}
								onClick={() => vectors.refetch()}
							>
								Refresh vector sources
							</Button>
						</>
					)}
					{form.path.binding.kind === "external" && (
						<ExternalPathEditor
							binding={form.path.binding}
							onChange={(next) => onEdit({ binding: next })}
						/>
					)}
					<Accordion variant="separated">
						<Accordion.Item value="identity">
							<Accordion.Control>Path technical details</Accordion.Control>
							<Accordion.Panel>
								<Text
									fz="xs"
									style={{ overflowWrap: "anywhere" }}
								>
									Path ID: {form.path.id}
								</Text>
							</Accordion.Panel>
						</Accordion.Item>
					</Accordion>
					<Text
						fz="xs"
						c="slate"
					>
						Apply to draft stages this edit. Use Save changes to apply your draft to
						RRFlow.
					</Text>
					{error && (
						<Alert
							color="red"
							role="alert"
						>
							{error}
						</Alert>
					)}
					<Group justify="flex-end">
						<Button
							variant="subtle"
							onClick={onClose}
						>
							Cancel
						</Button>
						<Button onClick={onApply}>Apply to draft</Button>
					</Group>
				</Stack>
			)}
		</Modal>
	);
}
