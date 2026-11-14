import { createFileRoute } from "@tanstack/react-router";
import { ProjectPlanPanel } from "~/features/runtime/plan/plan";
import { useProject } from "~/features/runtime/project/context";
import { iconRoutes } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/reasoning/plan")({
	staticData: {
		menu: {
			label: "Project plan",
			group: "reasoning",
			order: 2,
			icon: iconRoutes,
			hint: "How the engine learns this project, step by step, and what each step found.",
		},
	},
	component: View,
});

function View() {
	const { session, client, sessionKey } = useProject();
	return (
		<ProjectPlanPanel
			key={sessionKey}
			client={client}
			instance={session?.instance ?? ""}
			connected={Boolean(session)}
		/>
	);
}
