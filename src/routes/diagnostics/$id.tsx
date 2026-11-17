import { createFileRoute } from "@tanstack/react-router";
import { RuntimeDiagnosticsPage } from "~/features/diagnostics";

export const Route = createFileRoute("/diagnostics/$id")({
	component: () => <RuntimeDiagnosticsPage id={Route.useParams().id} />,
});
