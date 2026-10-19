import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { adapter } from "~/adapter";
import { useConnectionNavigator, useIntent } from "~/hooks/routing";
import { useStable } from "~/hooks/stable";
import { openConnectionEditModal } from "~/modals/edit-connection";
import { describeRrdError } from "~/rrflow/runtime";
import {
	allowSessionReconnect,
	SESSION_QUERY_KEY,
} from "~/screens/connectome/pages/RuntimeConnection/session";
import { tagEvent } from "~/shared/util/analytics";
import { getActiveConnection, getConnection } from "~/shared/util/connection";
import { createBaseConnection } from "~/shared/util/defaults";
import { showErrorNotification, showInfo } from "~/shared/util/helpers";
import { dispatchIntent } from "~/shared/util/intents";
import { useConfigStore } from "~/shell/stores/config";
import { useDatabaseStore } from "~/stores/database";
import type { Connection, EstateServeRequest, ServedEstate } from "~/types";
import { Icon, iconConsole, iconPlay, iconStop } from "../../rrflow/ui/index";
import { ActionButton } from "../ActionButton";

/**
 * The runtime connection that reaches the served estate. One connection per
 * estate project: it is found by the operator credential the installation
 * wrote, updated with the address the engine announced this time (the kernel
 * chooses the port), and created on first serve.
 */
function resolveServedConnection(estate: ServedEstate, selected?: Connection) {
	const { settings, connections, addConnection, updateConnection } = useConfigStore.getState();

	const hostname = estate.endpoint.replace(/^https?:\/\//, "");
	const existing =
		selected ??
		connections.find(
			(candidate) =>
				candidate.target === "runtime" &&
				candidate.runtimeCredential === estate.credential_path,
		);

	if (existing) {
		updateConnection({
			id: existing.id,
			runtimeProject: estate.project,
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
		runtimeProject: estate.project,
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
	const [isReconnecting, setIsReconnecting] = useState(false);
	const queryClient = useQueryClient();

	const cancelServe = useDatabaseStore((s) => s.cancelServe);
	const prepareServe = useDatabaseStore((s) => s.prepareServe);
	const confirmServing = useDatabaseStore((s) => s.confirmServing);
	const stopServing = useDatabaseStore((s) => s.stopServing);
	const isServing = useDatabaseStore((s) => s.isServing);
	const isPending = useDatabaseStore((s) => s.servePending);
	const navigateConnection = useConnectionNavigator();
	const selectedConnection = useConfigStore((state) =>
		state.connections.find((candidate) => candidate.id === getActiveConnection()),
	);
	const isRemote = Boolean(
		selectedConnection?.target === "runtime" && selectedConnection.runtimeSshHost?.trim(),
	);

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
			.catch((error) => {
				showErrorNotification({
					title: "Could not inspect local serving",
					content: describeRrdError(error),
				});
			});
	}, [confirmServing]);

	const handleToggle = useStable(async () => {
		if (isPending || isReconnecting) {
			return;
		}

		const selected = getConnection();
		// A saved SSH profile reaches an already-running estate. Reconnect
		// through the existing handshake, which owns its native forward.
		// Local process controls never apply to the remote engine.
		if (selected?.target === "runtime" && selected.runtimeSshHost?.trim()) {
			setIsReconnecting(true);
			allowSessionReconnect(selected.id);
			try {
				await Promise.all([
					queryClient.resetQueries({
						predicate: (query) =>
							query.queryKey[0] === "rrd-runtime-handshake" &&
							query.queryKey[1] === selected.id,
					}),
					queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
				]);
			} finally {
				setIsReconnecting(false);
			}
			return;
		}

		if (isServing) {
			cancelServe();
			const estate = useDatabaseStore.getState().servedEstate;
			let failure: unknown;
			let stopCompleted = false;

			try {
				await adapter.stopEstate();
				stopCompleted = true;
			} catch (error) {
				failure = error;
			}

			// Reconcile from the native child handle. A failed kill retains the
			// owned child and keeps Stop available; it cannot report offline.
			try {
				const remaining = await adapter.servedEstate();
				if (remaining) {
					confirmServing(remaining);
					failure ??= new Error(
						`The local estate is still serving at ${remaining.endpoint}`,
					);
				} else stopServing();
			} catch (error) {
				if (stopCompleted || !estate) stopServing();
				else confirmServing(estate);
				failure = failure
					? new Error(
							`${describeRrdError(failure)}. Process status: ${describeRrdError(error)}`,
						)
					: error;
			}

			await Promise.all([
				queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY, refetchType: "all" }),
				queryClient.resetQueries({
					predicate: (query) =>
						Boolean(estate) &&
						query.queryKey[0] === "rrd-runtime-handshake" &&
						query.queryKey[2] === estate?.endpoint,
				}),
			]);

			if (failure) {
				showErrorNotification({
					title: "Stopping failed",
					content: describeRrdError(failure),
				});
				return;
			}
			showInfo({
				title: "Serving stopped",
				subtitle: "The local estate is offline",
			});

			return;
		}

		const existingRuntime = selected?.target === "runtime" ? selected : undefined;
		const { project, mode, executable } = useConfigStore.getState().settings.serving;
		let request: EstateServeRequest;
		if (existingRuntime) {
			const existingProject = existingRuntime.runtimeProject?.trim();
			if (!existingProject) {
				openConnectionEditModal(existingRuntime);
				showErrorNotification({
					title: "Select this connection's installed estate",
					content: `Choose the existing project directory for ${existingRuntime.name}. Starting this connection opens that installed estate at its saved address.`,
				});
				return;
			}
			request = {
				operation: "open_installed",
				project: existingProject,
				endpoint: `${existingRuntime.authentication.protocol}://${existingRuntime.authentication.hostname}`,
				expected_instance: existingRuntime.runtimeInstance || undefined,
				executable,
			};
		} else {
			if (!project.trim()) {
				dispatchIntent("open-connections");
				showInfo({
					title: "Choose the connection to serve",
					subtitle:
						"Open your saved runtime connection, then start its installed estate.",
				});
				return;
			}
			request = { operation: "install_and_serve", project, mode, executable };
		}

		prepareServe();
		setHasStarted(true);

		try {
			const estate = await adapter.serveEstate(request);

			confirmServing(estate);
			tagEvent("database_serve");

			showInfo({
				title: estate.installed ? "Estate installed and serving" : "Serving started",
				subtitle: `${estate.instance} at ${estate.endpoint}`,
			});

			navigateConnection(resolveServedConnection(estate, existingRuntime));
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
				loading={isPending || isReconnecting}
				label={isRemote ? "Reconnect" : isServing ? "Stop serving" : "Start serving"}
				tooltipProps={{
					position: "bottom",
					label: isRemote
						? "Reconnect to this saved remote estate"
						: isServing
							? "Stop the local estate"
							: "Install or open the local estate and start RRFlow",
					children: null,
				}}
				color={!isRemote && isServing ? "pink.7" : undefined}
				aria-label={
					isRemote
						? "Reconnect to saved estate"
						: isServing
							? "Stop serving local estate"
							: "Start serving local estate"
				}
				variant="subtle"
			>
				<Icon
					path={!isRemote && isServing ? iconStop : iconPlay}
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
