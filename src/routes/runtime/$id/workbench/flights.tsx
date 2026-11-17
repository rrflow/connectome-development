import { createFileRoute } from "@tanstack/react-router";
import { FlightsView } from "~/features/runtime/flights/flights-view";
import { iconPlay } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/workbench/flights")({
	staticData: {
		menu: {
			label: "Prompt flights",
			order: 1,
			icon: iconPlay,
			hint: "Each prompt the engine recorded, with the steps it took and the context it gathered.",
			count: "flights",
		},
	},
	component: FlightsView,
});
