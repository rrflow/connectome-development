import { createFileRoute, Outlet } from "@tanstack/react-router";
import { iconBrain } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/reasoning")({
	staticData: {
		area: {
			label: "Reasoning",
			order: 5,
			icon: iconBrain,
			hint: "The work the engine does: tasks, plans, prompt traces, runs and routing.",
		},
	},
	component: Outlet,
});
