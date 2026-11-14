import { createFileRoute } from "@tanstack/react-router";
import { ConnectionsView } from "~/features/runtime/connections/connections-view";
import { iconServerSecure } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/system/connections")({
	staticData: {
		menu: {
			label: "Connections",
			group: "system",
			order: 3,
			icon: iconServerSecure,
			hint: "Every project this app knows, and whether its engine answers right now.",
			count: "connections",
		},
	},
	component: ConnectionsView,
});
