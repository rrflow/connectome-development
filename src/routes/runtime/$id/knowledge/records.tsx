import { createFileRoute } from "@tanstack/react-router";
import { useLensProps, useProject } from "~/features/runtime/project/context";
import { RecordsTab } from "~/features/runtime/records/records-tab";
import { iconRelation } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/knowledge/records")({
	staticData: {
		menu: {
			label: "Runtime graph",
			group: "knowledge",
			order: 1,
			icon: iconRelation,
			hint: "What the project knows and how each record links to the others.",
		},
	},
	component: View,
});

function View() {
	const { session } = useProject();
	const lens = useLensProps();
	return session ? (
		<RecordsTab
			connection={session}
			{...lens}
		/>
	) : null;
}
