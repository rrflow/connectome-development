import type { ServedEngram } from "~/shared/types";
import { createBaseConnection } from "~/shared/util/config/defaults";
import { useConfigStore } from "~/shell/stores/config";

/**
 * The runtime connection that reaches the served engram. One connection per
 * engram project: it is found by the operator credential the installation
 * wrote, updated with the address the engine announced this time (the kernel
 * chooses the port), and created on first serve.
 */
export function resolveServedConnection(engram: ServedEngram) {
	const { settings, connections, addConnection, updateConnection } = useConfigStore.getState();

	const hostname = engram.endpoint.replace(/^https?:\/\//, "");
	const existing = connections.find(
		(candidate) =>
			candidate.target === "runtime" &&
			candidate.runtimeCredential === engram.credential_path,
	);

	if (existing) {
		updateConnection({
			id: existing.id,
			runtimeInstance: engram.instance,
			runtimeProject: engram.project,
			authentication: {
				...existing.authentication,
				protocol: "http",
				hostname,
			},
		});

		return existing.id;
	}

	const base = createBaseConnection(settings);

	addConnection({
		...base,
		name:
			engram.project.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? "Local project",
		target: "runtime",
		runtimeInstance: engram.instance,
		runtimeCredential: engram.credential_path,
		runtimeProject: engram.project,
		authentication: {
			...base.authentication,
			protocol: "http",
			hostname,
			mode: "none",
			username: "",
			password: "",
			token: "",
		},
	});

	return base.id;
}
