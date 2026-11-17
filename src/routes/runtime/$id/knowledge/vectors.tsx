import { createFileRoute } from "@tanstack/react-router";
import { useLensProps, useProject } from "~/features/runtime/project/context";
import { VectorsTab } from "~/features/runtime/vectors/vectors-tab";
import { iconTarget } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/knowledge/vectors")({
	staticData: {
		menu: {
			label: "Vectors",
			order: 3,
			icon: iconTarget,
			hint: "Find records with similar meaning by comparing their vectors.",
			count: "collections",
		},
	},
	component: View,
});

function View() {
	const { session } = useProject();
	const lens = useLensProps();
	return session ? (
		<VectorsTab
			connection={session}
			{...lens}
		/>
	) : null;
}
