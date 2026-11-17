import { createFileRoute, Outlet } from "@tanstack/react-router";
import { iconRelation } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/knowledge")({
	staticData: {
		area: {
			label: "Knowledge",
			order: 3,
			icon: iconRelation,
			hint: "What the project knows: its records, their shapes, vectors, tables and claims.",
		},
	},
	component: Outlet,
});
