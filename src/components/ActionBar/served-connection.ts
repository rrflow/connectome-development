import { createBaseConnection } from "~/shared/util/defaults";
import { useConfigStore } from "~/shell/stores/config";
import type { Servedengram } from "~/types";

/**
 * The runtime connection that reaches the served engram. One connection per
 * engram project: it is found by the operator credential the installation
 * wrote, updated with the address the engine announced this time (the kernel
 * chooses the port), and created on first serve.
 */
export function resolveServedConnection(engram: Servedengram) {
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
