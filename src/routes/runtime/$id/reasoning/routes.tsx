import { createFileRoute } from "@tanstack/react-router";
import { RoutesView } from "~/features/runtime/routes/routes-view";
import { iconTransfer } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/reasoning/routes")({
	staticData: {
		menu: {
			label: "Routes",
			order: 6,
			icon: iconTransfer,
			hint: "Which model endpoint decides where work goes, and which endpoints it may pick.",
		},
	},
	component: RoutesView,
});
