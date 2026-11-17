import { createFileRoute, Outlet } from "@tanstack/react-router";
import { iconServer } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/system")({
	staticData: {
		area: {
			label: "System",
			order: 7,
			icon: iconServer,
			hint: "Which engine this is, how it is reached, and what it can do.",
		},
	},
	component: Outlet,
});
