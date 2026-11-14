import { createFileRoute } from "@tanstack/react-router";
import { ClaimsView } from "~/features/runtime/claims/claims-view";
import { iconTag } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/knowledge/claims")({
	staticData: {
		menu: {
			label: "Claims",
			group: "knowledge",
			order: 5,
			icon: iconTag,
			hint: "The statements the engine holds as true, and the period each one is true for.",
		},
	},
	component: ClaimsView,
});
