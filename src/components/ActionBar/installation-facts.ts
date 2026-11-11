/**
 * What an installation preview means for a person, read from the engine's exact
 * plan. Every fact comes from a field of that plan; a field this version does
 * not recognise is left out rather than guessed at.
 */
export interface InstallationFacts {
	/** Folders and files RRFlow creates and owns inside the project. */
	createdPaths: string[];
	/** The project's own files are left as they are. */
	preservesProjectFiles: boolean;
	/** The engine serves only this computer. */
	loopbackOnly: boolean;
	networkEndpoints: number | null;
	outsidePrograms: number | null;
	aiProviders: number | null;
	permissions: number | null;
	/** Attunement phases that run after installation, in order. */
	phases: string[];
	productVersion: string | null;
	planSha256: string | null;
}

type Fields = Record<string, unknown>;

const record = (value: unknown): Fields =>
	typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Fields) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const count = (value: unknown): number | null => (Array.isArray(value) ? value.length : null);
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** `preview` is the engine's plan as the native process returns it. */
export function installationFacts(preview: unknown): InstallationFacts {
	const plan = record(preview);
	const installation = record(plan.installation);
	const bootstrap = record(installation.bootstrap);
	const deployment = record(installation.deployment);
	const attunement = record(plan.attunement);
	const createdPaths = [
		...new Set(
			list(installation.managed_paths)
				.map((path) => text(record(path).relative_path))
				.filter((path): path is string => Boolean(path)),
		),
	].sort();
	const phases = list(attunement.phases)
		.map((phase) => record(phase))
		.sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0))
		.map((phase) => text(phase.phase))
		.filter((phase): phase is string => Boolean(phase));
	return {
		createdPaths,
		preservesProjectFiles: bootstrap.project_policy === "preserve_project_owned_state",
		loopbackOnly: deployment.endpoint_presentation === "loopback_http_websocket",
		networkEndpoints: count(bootstrap.network_endpoints),
		outsidePrograms: count(bootstrap.process_invocations),
		aiProviders: count(bootstrap.activated_provider_bindings),
		permissions: count(installation.initial_grants),
		phases,
		productVersion: text(installation.product_version),
		planSha256: text(installation.plan_sha256),
	};
}

/** The engine refuses a fresh install in a folder that already holds files. */
export function refusedAsFresh(error: string | null, mode: string): boolean {
	return mode === "fresh" && Boolean(error?.includes("ProjectBindingMismatch"));
}

const SLASH = "\\";
const EXTENDED = `${SLASH}${SLASH}?${SLASH}`;
const EXTENDED_SHARE = `${EXTENDED}UNC${SLASH}`;

/** A path as a person reads it: Windows' extended-length prefix is plumbing, not part of the name. */
export function displayPath(path: string): string {
	if (path.startsWith(EXTENDED_SHARE)) {
		return `${SLASH}${SLASH}${path.slice(EXTENDED_SHARE.length)}`;
	}
	if (path.startsWith(EXTENDED)) return path.slice(EXTENDED.length);
	return path;
}
