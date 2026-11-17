import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeTab } from "~/features/runtime/knowledge-paths/knowledge-tab";
import { useLensProps, useProject } from "~/features/runtime/project/context";
import { iconOpenFolder } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/knowledge/paths")({
	staticData: {
		menu: {
			label: "Paths",
			order: 6,
			icon: iconOpenFolder,
			hint: "Organize what the project knows into trees, and point each part at a source.",
		},
	},
	component: View,
});

function View() {
	const { session } = useProject();
	const lens = useLensProps();
	return session ? (
		<KnowledgeTab
			connection={session}
			{...lens}
		/>
	) : null;
}
