import { createFileRoute } from "@tanstack/react-router";
import { StreamView } from "~/features/runtime/stream/stream-view";
import { iconClock } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/activity/stream")({
	staticData: {
		menu: {
			label: "Temporal stream",
			group: "activity",
			order: 1,
			icon: iconClock,
			hint: "Every change saved to this project, in order, with a scrubber to step through time.",
		},
	},
	component: StreamView,
});
