import { createFileRoute } from "@tanstack/react-router";
import { EnginesView } from "~/features/runtime/engines/engines-view";
import { iconDatabase } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/system/engines")({
	staticData: {
		menu: {
			label: "Engines",
			group: "system",
			order: 4,
			icon: iconDatabase,
			hint: "The engine programs this desktop app is running for your projects, read live.",
		},
	},
	component: EnginesView,
});
