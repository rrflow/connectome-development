import { createFileRoute } from "@tanstack/react-router";
import { useProject } from "~/features/runtime/project/context";
import { WorkbenchPanel } from "~/features/runtime/workbench/workbench";
import { iconHammer } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/workbench/")({
	staticData: {
		menu: {
			label: "Workbench",
			group: "workbench",
			order: 1,
			icon: iconHammer,
			hint: "Run prompts against this project and see exactly what the engine read.",
		},
	},
	component: View,
});

function View() {
	const { id, client, sessionKey, session, open, openLens, onSelect } = useProject();
	return (
		<WorkbenchPanel
			key={id}
			client={client}
			connectionId={id}
			sessionKey={sessionKey}
			connected={Boolean(session)}
			onOpenGraph={() => openLens("records")}
			onOpenStorage={() => openLens("storage")}
			onOpenRoute={open}
			onSelectRecord={(record) => {
				onSelect(record);
				openLens("records");
			}}
		/>
	);
}
