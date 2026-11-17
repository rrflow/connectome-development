import { createFileRoute, Outlet } from "@tanstack/react-router";
import { iconMemory } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/engine")({
	staticData: {
		area: {
			label: "Engine",
			order: 4,
			icon: iconMemory,
			hint: "The storage layers under the project, with their live counters.",
		},
	},
	component: Outlet,
});
