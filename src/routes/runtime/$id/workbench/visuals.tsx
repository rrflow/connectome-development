import { Box, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { useProject } from "~/features/runtime/project/context";
import { ProjectVisuals } from "~/features/runtime/workbench/visuals";
import { iconChart } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/workbench/visuals")({
	staticData: {
		menu: {
			label: "Visuals",
			order: 2,
			icon: iconChart,
			hint: "Pictures of this project: its files, how its records link, and how data is stored.",
		},
	},
	component: View,
});

function View() {
	const { session, client, sessionKey, onSelect, openLens } = useProject();
	if (!session) return null;
	return (
		<Stack gap="lg">
			<Box>
				<PrimaryTitle>Visuals</PrimaryTitle>
				<Text mt="xs">
					Pictures drawn from what the engine holds for this project right now: the files
					it knows, how its records link to each other, and the path data takes into
					storage. Click a record to open it in the graph.
				</Text>
			</Box>
			<ProjectVisuals
				client={client}
				sessionKey={sessionKey}
				connected
				onOpenGraph={() => openLens("records")}
				onOpenStorage={() => openLens("storage")}
				onSelectRecord={(record) => {
					onSelect(record);
					openLens("records");
				}}
			/>
		</Stack>
	);
}
