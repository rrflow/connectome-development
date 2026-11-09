import type { Connection, InstanceStatus, ProjectInstance } from "~/types";

/**
 * Each project's RRFlow instance in the webview (sprint 009, decision 19).
 *
 * The native registry numbers every transition and sends each one as an
 * event; a status read lists every tracked instance as of one number. The two
 * can arrive in either order, so each project keeps the newest view it has
 * seen. A stopped instance stays as a stopped entry, so an older status read
 * cannot bring it back.
 */
export type InstanceMap = Record<string, ProjectInstance>;

export function applyInstance(current: InstanceMap, instance: ProjectInstance): InstanceMap {
	const known = current[instance.project];
	if (known && known.revision > instance.revision) {
		// A stop that a status read noticed first keeps the reason its own
		// transition gives.
		if (known.state === "stopped" && instance.state === "stopped") {
			return {
				...current,
				[instance.project]: { ...known, origin: instance.origin, detail: instance.detail },
			};
		}
		return current;
	}
	return { ...current, [instance.project]: instance };
}

export function applyStatus(current: InstanceMap, status: InstanceStatus): InstanceMap {
	let next = current;
	for (const instance of status.instances) {
		next = applyInstance(next, instance);
	}
	const listed = new Set(status.instances.map((instance) => instance.project));
	for (const known of Object.values(next)) {
		if (
			!listed.has(known.project) &&
			known.state !== "stopped" &&
			known.revision <= status.revision
		) {
			next = {
				...next,
				[known.project]: {
					project: known.project,
					state: "stopped",
					origin: known.origin,
					detail: "Not running.",
					revision: status.revision,
				},
			};
		}
	}
	return next;
}

/** The first ready instance's coordinates, for the screens that show one. */
export function firstServed(instances: InstanceMap) {
	return Object.values(instances).find((instance) => instance.state === "ready")?.estate ?? null;
}

const CREDENTIAL_SUFFIX = /^(.*)[\\/]\.rrflow[\\/]credentials[\\/]local-operator\.json$/;

/**
 * The project directory a saved runtime connection opens. Connections saved
 * before they recorded it name the operator credential the installation wrote
 * inside the project, at `.rrflow/credentials/local-operator.json`.
 */
export function connectionProject(connection: Connection): string | undefined {
	if (connection.target !== "runtime") return undefined;
	if (connection.runtimeProject) return connection.runtimeProject;
	return connection.runtimeCredential?.match(CREDENTIAL_SUFFIX)?.[1];
}
