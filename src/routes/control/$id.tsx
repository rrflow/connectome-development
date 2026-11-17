import { createFileRoute } from "@tanstack/react-router";
import { ControlPlanePage } from "~/features/control-plane";

export const Route = createFileRoute("/control/$id")({
	component: () => <ControlPlanePage id={Route.useParams().id} />,
});
