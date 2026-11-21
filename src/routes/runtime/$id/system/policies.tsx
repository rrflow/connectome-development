import { createFileRoute } from "@tanstack/react-router";
import { PolicyPanel } from "~/features/runtime/policies/panel";
import { useProject } from "~/features/runtime/project/context";
import { iconTune } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/system/policies")({
	staticData: {
		menu: {
			label: "Policies and preferences",
			order: 8,
			icon: iconTune,
			hint: "Project limits, inherited user requirements, and the values the engine enforces.",
		},
	},
	component: View,
});
function View() {
	const { id, session, client, sessionKey } = useProject();
	return (
		<PolicyPanel
			key={sessionKey}
			client={client}
			connected={Boolean(session)}
			recoveryKey={`rrflow-policy:${id}:${session?.instance ?? "disconnected"}`}
		/>
	);
}
