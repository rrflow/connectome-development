import { createFileRoute } from "@tanstack/react-router";
import { EngineTab } from "~/features/runtime/engine/engine-tab";
import { useLensProps, useProject } from "~/features/runtime/project/context";
import { iconTarget } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/engine/cursor")({
	staticData: {
		menu: {
			label: "One engine",
			order: 0,
			icon: iconTarget,
			hint: "rrflowDB, rrflowKV, rrflowQL and rrflowCLD on the one change cursor they share, live.",
		},
	},
	component: View,
});

function View() {
	const { session } = useProject();
	const lens = useLensProps();
	return session ? (
		<EngineTab
			connection={session}
			{...lens}
		/>
	) : null;
}
