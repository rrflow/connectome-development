import { createWasmWorkerEngines } from "@surrealdb/wasm";
import WasmWorker from "@surrealdb/wasm/worker?worker";
import { getSetting } from "~/shared/util/config";
import { useDatabaseStore } from "~/stores/database";
import { applyDiagnostics, createRemoteEngines, RRFlow } from "~/vendor/rrflow-client";

/**
 * Create a new configured RRFlow instance
 */
export async function createRRFlow() {
	const { pushDiagnostic } = useDatabaseStore.getState();
	const maxSize = getSetting("behavior", "diagnosticsHistorySize");

	const engines = {
		...createRemoteEngines(),
		...createWasmWorkerEngines({
			createWorker: () => new WasmWorker({ name: "Connectome-wasm" }),
			capabilities: {
				experimental: true,
				functions: true,
				guest_access: true,
				live_query_notifications: true,
				network_targets: true,
			},
		}),
	};

	return new RRFlow({
		engines: applyDiagnostics(engines, (diagnostic) => {
			if (getSetting("behavior", "recordDiagnostics")) {
				pushDiagnostic(diagnostic, maxSize);
			}
		}),
	});
}
