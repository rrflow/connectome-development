import { createFileRoute } from "@tanstack/react-router";
import { ClusterView } from "~/features/runtime/cluster/cluster-view";
import { iconNamespace } from "~/shared/assets/icons";

export const Route = createFileRoute("/runtime/$id/system/cluster")({
	staticData: {
		menu: {
			label: "Cluster history",
			order: 6,
			icon: iconNamespace,
			hint: "The engines that serve this engram, and every start, stop and upgrade recorded for them.",
		},
	},
	component: ClusterView,
});
