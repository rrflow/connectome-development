import { createFileRoute } from "@tanstack/react-router";
import { useProject } from "~/features/runtime/project/context";
import { TasksPanel } from "~/features/runtime/tasks/tasks";
import { iconList } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/reasoning/tasks")({
	staticData: {
		menu: {
			label: "Tasks",
			group: "reasoning",
			order: 1,
			icon: iconList,
			hint: "Units of work the engine tracks, with the prompts that belong to each.",
		},
	},
	component: View,
});

function View() {
	const { session, client, sessionKey } = useProject();
	return (
		<TasksPanel
			key={sessionKey}
			client={client}
			instance={session?.instance ?? ""}
			connected={Boolean(session)}
		/>
	);
}
