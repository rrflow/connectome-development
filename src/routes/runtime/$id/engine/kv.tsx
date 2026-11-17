import { createFileRoute } from "@tanstack/react-router";
import { EngineLayer } from "~/features/runtime/engine/engine-layer";
import { iconDatabase } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/engine/kv")({
	staticData: {
		menu: {
			label: "rrflowKV",
			order: 2,
			icon: iconDatabase,
			hint: "The durable store under everything: write-ahead log, commits and cache, live.",
		},
	},
	component: () => <EngineLayer layer="kv" />,
});
