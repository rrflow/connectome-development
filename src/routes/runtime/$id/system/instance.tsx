import { createFileRoute } from "@tanstack/react-router";
import { InstanceView } from "~/features/runtime/instance/instance";
import { iconServer } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/system/instance")({
	staticData: {
		menu: {
			label: "Instance",
			order: 1,
			icon: iconServer,
			hint: "Which engine this window is talking to, and proof that it is the right one.",
		},
	},
	component: View,
});

function View() {
	return <InstanceView />;
}
