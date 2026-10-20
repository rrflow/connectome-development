import { Alert, Button, Group, Modal, ScrollArea, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { adapter } from "~/adapter";
import { Icon } from "~/components/Icon";
import { useConnectionNavigator, useIntent } from "~/hooks/routing";
import { useStable } from "~/hooks/stable";
import { iconConsole, iconPlay, iconStop } from "~/icons";
import { describeRrdError } from "~/rrflow/runtime";
import { createBaseConnection } from "~/shared/util/defaults";
import { showErrorNotification, showInfo } from "~/shared/util/helpers";
import { dispatchIntent } from "~/shared/util/intents";
import { useConfigStore } from "~/shell/stores/config";
import { useDatabaseStore } from "~/stores/database";
import type { EstatePreview, ServedEstate } from "~/types";
import { ActionButton } from "../ActionButton";

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
	const [preview, setPreview] = useState<EstatePreview | null>(null);

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
		try {
			const next = await adapter.previewEstate();
			if (next.installation) {
				setPreview(next);
				return;
			}
			await start();
		} catch (error) {
			stopServing();
			showErrorNotification({
				title: "Cannot prepare local RRFlow",
				content: describeRrdError(error),
			});
		}
	});

	const start = async (digest?: string) => {
		setPreview(null);
		prepareServe();
		setHasStarted(true);
		try {
			const estate = await adapter.serveEstate(digest);
			confirmServing(estate);
			navigateConnection(resolveServedConnection(estate));
		} catch (error) {
			stopServing();
			showErrorNotification({ title: "Serving failed", content: describeRrdError(error) });
		}
	};
	const cancelPreview = () => {
		setPreview(null);
		stopServing();
	};

	const openConsole = useStable(() => {
		dispatchIntent("open-serving-console");
	});

	useIntent("toggle-serving", handleToggle);

	return (
		<>
			<Modal
				opened={preview !== null}
				onClose={cancelPreview}
				title="Review your local RRFlow installation"
				size="xl"
			>
				{preview && (
					<Stack>
						<Text>
							RRFlow will create its database and local credentials in this project.
							No cloud account or upload is enabled.
						</Text>
						<Text fw={600}>{preview.project}</Text>
						<Text size="sm">
							Mode: {preview.mode}; Engine: {preview.engine.source}
						</Text>
						<Alert
							title="Exact installation preview"
							color="blue"
						>
							Review the managed paths, configuration and permissions below. Cancel
							leaves the project uninstalled; an empty project folder may have been
							created.
						</Alert>
						<ScrollArea h={280}>
							<pre
								style={{
									whiteSpace: "pre-wrap",
									overflowWrap: "anywhere",
									fontSize: 12,
								}}
							>
								{JSON.stringify(preview.installation, null, 2)}
							</pre>
						</ScrollArea>
						<Group justify="flex-end">
							<Button
								variant="subtle"
								onClick={cancelPreview}
							>
								Cancel
							</Button>
							<Button
								onClick={() =>
									start(preview.installation?.installation.plan_sha256)
								}
							>
								Install and open RRFlow
							</Button>
						</Group>
					</Stack>
				)}
			</Modal>
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
