import { createFileRoute } from "@tanstack/react-router";
import { RunsView } from "~/features/runtime/runs/runs-view";
import { iconHistory } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/reasoning/runs")({
	staticData: {
		menu: {
			label: "Runs",
			group: "reasoning",
			order: 4,
			icon: iconHistory,
			hint: "The learning jobs and tasks the engine keeps a lasting record of, with their state.",
		},
	},
	component: RunsView,
});
