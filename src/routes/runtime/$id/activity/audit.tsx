import { createFileRoute } from "@tanstack/react-router";
import { ActivityView } from "~/features/runtime/activity/activity-view";
import { iconHistory } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/activity/audit")({
	staticData: {
		menu: {
			label: "Activity",
			order: 2,
			icon: iconHistory,
			hint: "The engine's own log of who asked it to do what, and when.",
		},
	},
	component: ActivityView,
});
