import { createFileRoute, Outlet } from "@tanstack/react-router";
import { iconHammer } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/workbench")({
	staticData: {
		area: {
			label: "Labs",
			order: 2,
			icon: iconHammer,
			hint: "Prompt flights, pictures of the project and the query lab.",
		},
	},
	component: Outlet,
});
