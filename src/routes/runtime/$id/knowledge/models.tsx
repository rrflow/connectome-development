import { createFileRoute } from "@tanstack/react-router";
import { ModelsTab } from "~/features/runtime/models/models-tab";
import { useProject } from "~/features/runtime/project/context";
import { iconModel } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/knowledge/models")({
	staticData: {
		menu: {
			label: "Data models",
			group: "knowledge",
			order: 2,
			icon: iconModel,
			hint: "The shapes of the data this project keeps, read from the live schema.",
			count: "models",
		},
	},
	component: View,
});

function View() {
	const { session, client, sessionKey, openLens } = useProject();
	return session ? (
		<ModelsTab
			client={client}
			sessionKey={sessionKey}
			onOpenLens={openLens}
		/>
	) : null;
}
