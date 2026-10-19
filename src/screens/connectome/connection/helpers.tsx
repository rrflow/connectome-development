import { objectify } from "radash";
import { fetchAPI } from "~/cloud/api";
import { getSetting } from "~/shared/util/config";
import { CloudError } from "~/shared/util/errors";
import { featureFlags } from "~/shared/util/feature-flags";
import type { Authentication } from "~/types";
import type { AccessRecordAuth, ProvidedAuth } from "../../../rrflow/client/native";

export async function composeAuthentication(connection: Authentication): Promise<ProvidedAuth> {
	const { mode, username, password, namespace, database, token, cloudInstance } = connection;

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
		case "cloud": {
			if (!cloudInstance) {
				throw new Error("Connection is not a cloud instance");
			}

			try {
				const response = await fetchAPI<{ token: string }>(
					`/instances/${cloudInstance}/auth`,
				);

				return response.token;
			} catch (err: any) {
				throw new CloudError("Failed to authenticate with cloud instance", {
					cause: err,
				});
			}
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
