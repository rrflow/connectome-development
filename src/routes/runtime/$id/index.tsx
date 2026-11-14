import { createFileRoute } from "@tanstack/react-router";
import { ProjectHome } from "~/features/runtime/home/project-home";
import { iconHome } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/")({
	staticData: {
		menu: {
			label: "Overview",
			group: "start",
			order: 1,
			icon: iconHome,
			hint: "What this project holds right now, and where to go next.",
		},
	},
	component: View,
});

function View() {
	return <ProjectHome />;
}
