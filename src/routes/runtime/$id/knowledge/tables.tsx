import { createFileRoute } from "@tanstack/react-router";
import { TablesView } from "~/features/runtime/tables/tables-view";
import { iconTable } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/knowledge/tables")({
	staticData: {
		menu: {
			label: "Tables",
			order: 4,
			icon: iconTable,
			hint: "The tables this project keeps and the rows currently in each one.",
			count: "tables",
		},
	},
	component: TablesView,
});
