import { createFileRoute } from "@tanstack/react-router";
import { TracesView } from "~/features/runtime/traces/traces-view";
import { iconRoutes } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/reasoning/traces")({
	staticData: {
		menu: {
			label: "Causal traces",
			group: "reasoning",
			order: 3,
			icon: iconRoutes,
			hint: "For one prompt, the steps the engine recorded, in the order it took them.",
		},
	},
	component: TracesView,
});
