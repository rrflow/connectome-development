import { getSetting } from "~/shared/util/config";
import { useDatabaseStore } from "~/stores/database";
import { RRFlow } from "../../../rrflow/client/native";

/**
 * Create a new configured RRFlow instance
 */
export async function createRRFlow() {
	const { pushDiagnostic } = useDatabaseStore.getState();
	const maxSize = getSetting("behavior", "diagnosticsHistorySize");

	return new RRFlow({
		onDiagnostic: (diagnostic) => {
			if (getSetting("behavior", "recordDiagnostics")) {
				pushDiagnostic(diagnostic, maxSize);
			}
		},
	});
}
