import { createBaseConnection } from "~/shared/util/defaults";
import { useConfigStore } from "~/shell/stores/config";
import type { ServedEstate } from "~/types";

/**
 * The runtime connection that reaches the served estate. One connection per
 * estate project: it is found by the operator credential the installation
 * wrote, updated with the address the engine announced this time (the kernel
 * chooses the port), and created on first serve.
 */
export function resolveServedConnection(estate: ServedEstate) {
	const { settings, connections, addConnection, updateConnection } = useConfigStore.getState();

	const hostname = estate.endpoint.replace(/^https?:\/\//, "");
	const existing = connections.find(
		(candidate) =>
			candidate.target === "runtime" &&
			candidate.runtimeCredential === estate.credential_path,
	);

	if (existing) {
		updateConnection({
			id: existing.id,
			runtimeInstance: estate.instance,
			runtimeProject: estate.project,
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
			estate.project.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? "Local project",
		target: "runtime",
		runtimeInstance: estate.instance,
		runtimeCredential: estate.credential_path,
		runtimeProject: estate.project,
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
