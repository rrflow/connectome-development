import { createFileRoute } from "@tanstack/react-router";
import { EngineLayer } from "~/features/runtime/engine/engine-layer";
import { iconMemory } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/engine/lsm")({
	staticData: {
		menu: {
			label: "rrflowLSM",
			order: 1,
			icon: iconMemory,
			hint: "The hot tier: recent writes in memory and sorted files, with live counters.",
		},
	},
	component: () => <EngineLayer layer="lsm" />,
});
