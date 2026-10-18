import { objectify } from "radash";
import { getSetting } from "~/shared/util/config";
import { featureFlags } from "~/shared/util/feature-flags";
import type { Authentication } from "~/types";
import type { AccessRecordAuth, ProvidedAuth } from "~/vendor/rrflow-client";

export async function composeAuthentication(connection: Authentication): Promise<ProvidedAuth> {
	const { mode, username, password, namespace, database, token } = connection;

	switch (mode) {
		case "root": {
			return { username, password };
		}
		case "namespace": {
			return { namespace, username, password };
		}
		case "database": {
			return { namespace, database, username, password };
		}
		case "access": {
			return buildAccessAuth(connection) as any; // TODO Horrible unforgivable temporary hack
		}
		case "token": {
			return token;
		}
		case "none": {
			return null;
		}
		default: {
			throw new Error("Invalid connection mode");
		}
	}
}

export function buildAccessAuth(connection: Authentication): AccessRecordAuth {
	const { namespace, database, access, accessFields } = connection;
	const variables = objectify(
		accessFields,
		(f) => f.subject,
		(f) => f.value,
	);

	return { namespace, database, access, variables };
}

export function getVersionTimeout() {
	const enabled = featureFlags.get("database_version_check");
	const timeout = (getSetting("behavior", "versionCheckTimeout") ?? 5) * 1000;
	return [enabled, timeout] as const;
}
