import { createFileRoute, Outlet } from "@tanstack/react-router";
import { iconHistory } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/activity")({
	staticData: {
		area: {
			label: "Activity",
			order: 6,
			icon: iconHistory,
			hint: "What changed and who asked for it, in the order it happened.",
		},
	},
	component: Outlet,
});
