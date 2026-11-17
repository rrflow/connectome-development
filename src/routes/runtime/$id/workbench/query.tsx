import { createFileRoute } from "@tanstack/react-router";
import { QueryLabView } from "~/features/runtime/query-lab/query-lab";
import { iconQuery } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/workbench/query")({
	staticData: {
		menu: {
			label: "Query lab",
			order: 3,
			icon: iconQuery,
			hint: "Ask the engine a question and see both the answer and how it chose to find it.",
		},
	},
	component: QueryLabView,
});
