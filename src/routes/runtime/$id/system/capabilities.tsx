import { createFileRoute } from "@tanstack/react-router";
import { CapabilitiesView } from "~/features/runtime/capabilities/capabilities-view";
import { iconCheck } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/system/capabilities")({
	staticData: {
		menu: {
			label: "Capabilities",
			order: 5,
			icon: iconCheck,
			hint: "What this project's engine says it can do, and how it is deployed.",
			count: "capabilities",
		},
	},
	component: CapabilitiesView,
});
