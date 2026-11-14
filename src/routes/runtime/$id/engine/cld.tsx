import { createFileRoute } from "@tanstack/react-router";
import { EngineLayer } from "~/features/runtime/engine/engine-layer";
import { iconDataTable } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/engine/cld")({
	staticData: {
		menu: {
			label: "rrflowCLD",
			group: "engine",
			order: 3,
			icon: iconDataTable,
			hint: "The columnar copy of settled history, and how far it has caught up.",
		},
	},
	component: () => <EngineLayer layer="cld" />,
});
