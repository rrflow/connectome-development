import { Box, NumberInput, ScrollArea, Select, Text, TextInput } from "@mantine/core";
import { useSetting } from "~/hooks/config";
import { useStable } from "~/hooks/stable";
import type { InstallMode, Selectable } from "~/types";
import { SettingsSection } from "../utilities";

const CAT = "serving";

const MODES: Selectable<InstallMode>[] = [
	{ label: "Fresh — the directory is empty or new", value: "fresh" },
	{ label: "Existing — the directory already holds a project", value: "existing" },
];

export function ServingTab() {
	const [project, setProject] = useSetting(CAT, "project");
	const [mode, setMode] = useSetting(CAT, "mode");
	const [executable, setExecutable] = useSetting(CAT, "executable");
	const [historySize, setHistorySize] = useSetting(CAT, "historySize");

	const updateHistorySize = useStable((value: string | number) => {
		setHistorySize(value as number);
	});

	return (
		<ScrollArea
			pr="xl"
			flex={1}
			scrollbars="y"
			type="always"
			pb={32}
		>
			<Box m="xs">
				<Text
					mb="xl"
					maw={520}
				>
					Connectome Desktop serves one local RRFlow estate. Starting it installs the
					estate the first time (a sealed plan you can read, then its exact apply), starts
					the engine on a loopback port the operating system chooses, and waits until the
					estate answers an authenticated readiness check. The operator credential stays a
					file the native process reads; nothing here asks for a username, a password, or
					a port.
				</Text>

				<SettingsSection
					label="Estate"
					maw={520}
				>
					<TextInput
						w="unset"
						label="Project directory"
						description="The directory that holds, or will hold, the estate's .rrflow tree. Leave empty to use the estate Connectome keeps in its own data directory."
						value={project}
						spellCheck={false}
						onChange={(e) => setProject(e.target.value)}
						placeholder="Leave empty for Connectome's default estate"
					/>

					<Select
						w="unset"
						label="Installation mode"
						description="Only used the first time, when the directory has no estate yet. Both modes preview the exact files RRFlow will create before anything is written."
						data={MODES}
						value={mode}
						onChange={setMode as any}
					/>
				</SettingsSection>

				<SettingsSection
					mt="xl"
					maw={520}
					label="Engine"
				>
					<TextInput
						w="unset"
						label="RRFlow executable path"
						description="The rrflow binary Connectome is contracted to. Leave empty to use the one on PATH."
						value={executable}
						spellCheck={false}
						onChange={(e) => setExecutable(e.target.value)}
						placeholder="Leave empty to infer from $PATH"
					/>

					<NumberInput
						w="unset"
						label="Console history size"
						description="How many lines of the engine's output the serving console keeps."
						value={historySize}
						onChange={updateHistorySize}
						min={1}
						max={10_000}
					/>
				</SettingsSection>
			</Box>
		</ScrollArea>
	);
}
