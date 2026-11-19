import { Box, NumberInput, ScrollArea, Text, TextInput } from "@mantine/core";
import { useSetting } from "~/hooks/app/config";
import { useStable } from "~/hooks/state/stable";
import { SettingsSection } from "../utilities";

const CAT = "serving";

export function ServingTab() {
	const [project, setProject] = useSetting(CAT, "project");
	const [instanceCheck, setInstanceCheck] = useSetting(CAT, "instanceCheckSeconds");
	const [executable, setExecutable] = useSetting(CAT, "executable");
	const [historySize, setHistorySize] = useSetting(CAT, "historySize");
	const [burstLines, setBurstLines] = useSetting(CAT, "outputBurstLines");
	const [refillMs, setRefillMs] = useSetting(CAT, "outputRefillMs");
	// A pace of zero or less is not a pace, so only a positive number is kept.
	const positive = (set: (value: number) => void) => (value: string | number) => {
		if (typeof value === "number" && value > 0) set(value);
	};

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
					Connectome Desktop runs a local RRFlow engine for each project you add. Starting
					one installs its engram the first time (a sealed plan you can read, then its
					exact apply; an empty folder is installed fresh, and RRFlow is added beside the
					files of any other folder), starts the engine on a loopback port the operating
					system chooses, and waits until the engram answers an authenticated readiness
					check. The operator credential stays a file the native process reads; nothing
					here asks for a username, a password, or a port.
				</Text>

				<SettingsSection
					label="engram"
					maw={520}
				>
					<TextInput
						w="unset"
						label="Project directory"
						description="The directory that holds, or will hold, the engram's .rrflow tree. Leave empty to use the engram Connectome keeps in its own data directory."
						value={project}
						spellCheck={false}
						onChange={(e) => setProject(e.target.value)}
						placeholder="Leave empty for Connectome's default engram"
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

					<NumberInput
						w="unset"
						label="Instance check interval (seconds)"
						description="How often Connectome looks at every project's instance for one that stopped, or one that was started outside Connectome. Nothing is checked while the window is hidden; it is checked at once when the window is shown again."
						value={instanceCheck}
						onChange={positive(setInstanceCheck)}
						min={1}
					/>

					<NumberInput
						w="unset"
						label="Console burst (lines)"
						description="How many lines of an engine's output the serving console takes at once. Lines that arrive faster than this allowance comes back are left out of the console; the engine's own log still has them."
						value={burstLines}
						onChange={positive(setBurstLines)}
						min={1}
					/>

					<NumberInput
						w="unset"
						label="Console refill (milliseconds)"
						description="How long it takes for one line of the console burst to come back."
						value={refillMs}
						onChange={positive(setRefillMs)}
						min={1}
					/>
				</SettingsSection>
			</Box>
		</ScrollArea>
	);
}
