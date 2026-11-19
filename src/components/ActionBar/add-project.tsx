import { Alert, Button, Collapse, Group, Stack, Text, TextInput } from "@mantine/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useId, useState } from "react";
import { describeRrdError } from "~/rrflow/runtime";
import { useConfigStore } from "~/shell/stores/config";

export interface AddProjectProps {
	canServe: boolean;
	/**
	 * Adds the folder as a project. Resolves once the project has its row;
	 * rejects when the folder could not be added at all.
	 */
	onAdd: (folder: string, endpointCredentialMapping?: string) => Promise<void>;
}

/**
 * The one way a project is added: pick its folder. Connectome reads whether
 * the folder is empty and plans the matching installation, so nothing here
 * asks for a mode. This form waits only for its own add; what happens to the
 * project afterwards is shown on that project's row.
 */
export function AddProject({ canServe, onAdd }: AddProjectProps) {
	const [folder, setFolder] = useState(() => useConfigStore.getState().settings.serving.project);
	const [mapping, setMapping] = useState("");
	const [advanced, setAdvanced] = useState(false);
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const advancedId = useId();

	const choose = async (
		pick: () => Promise<string | string[] | null>,
		set: (path: string) => void,
	) => {
		setError(null);
		try {
			const path = await pick();
			if (typeof path === "string") set(path);
		} catch (cause) {
			setError(describeRrdError(cause));
		}
	};

	const add = async () => {
		setAdding(true);
		setError(null);
		try {
			await onAdd(folder, mapping.trim() || undefined);
			setFolder("");
			setMapping("");
		} catch (cause) {
			setError(describeRrdError(cause));
		} finally {
			setAdding(false);
		}
	};

	return (
		<Stack gap="sm">
			<Text fw={700}>Add project</Text>
			<Text size="sm">
				Pick the project's folder. An empty or new folder gets a fresh RRFlow installation;
				in any other folder RRFlow is added beside the files already there and leaves them
				as they are. You review the exact installation before anything is written, then
				Connectome installs it, starts its engine and opens it. A folder that already has
				RRFlow is started and opened. If you start another project or close this window
				before it has started, it stays in the list as running, with its own Open project
				button.
			</Text>
			<Group align="end">
				<TextInput
					flex={1}
					label="Project directory"
					description="An absolute folder path; leave empty for Connectome's own local engram."
					value={folder}
					disabled={adding}
					spellCheck={false}
					onChange={(event) => setFolder(event.currentTarget.value)}
				/>
				<Button
					variant="light"
					disabled={!canServe || adding}
					onClick={() =>
						choose(() => open({ directory: true, multiple: false }), setFolder)
					}
				>
					Choose folder
				</Button>
			</Group>
			<Group>
				<Button
					loading={adding}
					disabled={!canServe}
					onClick={add}
				>
					Add project
				</Button>
				<Button
					variant="subtle"
					aria-expanded={advanced}
					aria-controls={advancedId}
					onClick={() => setAdvanced(!advanced)}
				>
					Advanced
				</Button>
			</Group>
			<Collapse
				id={advancedId}
				in={advanced}
			>
				<Group align="end">
					<TextInput
						flex={1}
						label="Endpoint credential mapping (optional)"
						description="An engine mapping file, read only by the engine when it starts. Set the environment variables it names before launching Connectome. Leave empty for no mapping."
						value={mapping}
						disabled={adding}
						spellCheck={false}
						onChange={(event) => setMapping(event.currentTarget.value)}
					/>
					<Button
						variant="light"
						disabled={!canServe || adding}
						onClick={() =>
							choose(
								() =>
									open({
										multiple: false,
										filters: [{ name: "Engine mapping", extensions: ["json"] }],
									}),
								setMapping,
							)
						}
					>
						Choose mapping file
					</Button>
				</Group>
			</Collapse>
			{error && (
				<Alert
					color="red"
					title="This folder could not be added"
				>
					{error}
				</Alert>
			)}
		</Stack>
	);
}
