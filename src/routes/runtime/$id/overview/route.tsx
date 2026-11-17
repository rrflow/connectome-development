import { createFileRoute, Outlet } from "@tanstack/react-router";
import { iconHome } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/overview")({
	staticData: {
		area: {
			label: "Home",
			order: 1,
			icon: iconHome,
			hint: "Where this project stands right now, and where to go next.",
		},
	},
	component: Outlet,
});
