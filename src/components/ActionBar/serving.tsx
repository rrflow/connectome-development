import { Icon, iconConsole, iconPlay, iconStop } from "@surrealdb/ui";
import { useEffect, useState } from "react";
import { adapter } from "~/adapter";
import { useConnectionNavigator, useIntent } from "~/hooks/routing";
import { useStable } from "~/hooks/stable";
import { describeRrdError } from "~/rrflow/runtime";
import { createBaseConnection } from "~/shared/util/defaults";
import { showErrorNotification, showInfo } from "~/shared/util/helpers";
import { dispatchIntent } from "~/shared/util/intents";
import { useConfigStore } from "~/shell/stores/config";
import { useDatabaseStore } from "~/stores/database";
import type { ServedEstate } from "~/types";
import { ActionButton } from "../ActionButton";

/**
 * The runtime connection that reaches the served estate. One connection per
 * estate project: it is found by the operator credential the installation
 * wrote, updated with the address the engine announced this time (the kernel
 * chooses the port), and created on first serve.
 */
function resolveServedConnection(estate: ServedEstate) {
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
		name: "Local estate",
		target: "runtime",
		runtimeInstance: estate.instance,
		runtimeCredential: estate.credential_path,
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

export function DatabaseServing() {
	const [hasStarted, setHasStarted] = useState(false);

	const cancelServe = useDatabaseStore((s) => s.cancelServe);
	const prepareServe = useDatabaseStore((s) => s.prepareServe);
	const confirmServing = useDatabaseStore((s) => s.confirmServing);
	const stopServing = useDatabaseStore((s) => s.stopServing);
	const isServing = useDatabaseStore((s) => s.isServing);
	const isPending = useDatabaseStore((s) => s.servePending);
	const navigateConnection = useConnectionNavigator();

	// A window opened while the native process already serves an estate
	// resumes it instead of starting a second one.
	useEffect(() => {
		if (!adapter.isServeSupported) {
			return;
		}

		adapter
			.servedEstate()
			.then((estate) => {
				if (estate) {
					confirmServing(estate);
					setHasStarted(true);
				}
			})
			.catch(() => {});
	}, [confirmServing]);

	const handleToggle = useStable(async () => {
		if (isPending) {
			return;
		}

		if (isServing) {
			cancelServe();

			try {
				await adapter.stopEstate();
			} finally {
				stopServing();
			}

			showInfo({
				title: "Serving stopped",
				subtitle: "The local estate is offline",
			});

			return;
		}

		prepareServe();
		setHasStarted(true);

		try {
			const estate = await adapter.serveEstate();

			confirmServing(estate);

			showInfo({
				title: estate.installed ? "Estate installed and serving" : "Serving started",
				subtitle: `${estate.instance} at ${estate.endpoint}`,
			});

			navigateConnection(resolveServedConnection(estate));
		} catch (error) {
			stopServing();

			showErrorNotification({
				title: "Serving failed",
				content: describeRrdError(error),
			});
		}
	});

	const openConsole = useStable(() => {
		dispatchIntent("open-serving-console");
	});

	useIntent("toggle-serving", handleToggle);

	return (
		<>
			<ActionButton
				w={36}
				h={36}
				onClick={handleToggle}
				loading={isPending}
				label={isServing ? "Stop serving" : "Start serving"}
				tooltipProps={{
					position: "bottom",
					label: isServing
						? "Stop the local estate"
						: "Install or open the local estate and start RRFlow",
					children: null,
				}}
				color={isServing ? "pink.7" : undefined}
				aria-label={isServing ? "Stop serving local estate" : "Start serving local estate"}
				variant="subtle"
			>
				<Icon
					path={isServing ? iconStop : iconPlay}
					size="xl"
				/>
			</ActionButton>

			{hasStarted && (
				<ActionButton
					w={36}
					h={36}
					onClick={openConsole}
					label="Open console"
					tooltipProps={{
						position: "bottom",
						label: "Open the serving console",
						children: null,
					}}
					variant="subtle"
				>
					<Icon
						path={iconConsole}
						size="xl"
					/>
				</ActionButton>
			)}
		</>
	);
}
