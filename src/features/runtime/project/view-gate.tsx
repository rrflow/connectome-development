import { Alert, Button, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Icon } from "~/components/Icon";
import { connectionProject } from "~/rrflow/instances";
import { describeRrdError, RrdRuntimeClient } from "~/rrflow/runtime";
import { type InstanceOffer, lifecycleState, VIEW_NEEDS, viewState } from "~/rrflow/views";
import { iconErrorCircle } from "~/shared/assets/icons";
import { useDatabaseStore } from "~/stores/database";
import { useProject } from "./context";

/**
 * Shows a view only when its project's engine runs and serves what the view calls. While the
 * catalogue is unread the view waits. A failed read is reported separately from
 * a missing operation; only an observed offer admits the gated view.
 */
export function ViewGate({ path, children }: { path: string; children: ReactNode }) {
	const { endpoint, connection, handshake } = useProject();
	const project = connectionProject(connection);
	const instance = useDatabaseStore((state) => (project ? state.instances[project] : undefined));
	const lifecycle = lifecycleState(instance);
	const needed = path in VIEW_NEEDS;
	const catalogue = useQuery({
		queryKey: [
			"rrd-catalogue",
			endpoint,
			connection.runtimeInstance,
			connection.runtimeSshHost,
		],
		enabled: needed && Boolean(handshake),
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
		queryFn: async () => {
			const offer = await new RrdRuntimeClient(
				endpoint,
				connection.runtimeInstance,
				connection.runtimeSshHost,
			).catalogue();
			if (
				![offer?.endpoints, offer?.websocket_endpoints].every(
					(operations) =>
						Array.isArray(operations) &&
						operations.every(
							(operation) => operation && typeof operation.operation === "string",
						),
				)
			) {
				throw new Error("The engine returned an invalid operation catalogue.");
			}
			return offer;
		},
	});
	if (lifecycle) {
		return (
			<Alert
				color={lifecycle.state === "failed" ? "red" : "yellow"}
				title={`This project's engine is ${lifecycle.state}`}
				icon={<Icon path={iconErrorCircle} />}
			>
				<Text size="sm">{lifecycle.detail}</Text>
			</Alert>
		);
	}
	if (!needed) return <>{children}</>;
	if (catalogue.isError) {
		return (
			<Alert
				color="red"
				title="Engine capabilities could not be checked"
			>
				<Stack gap="xs">
					<Text size="sm">{describeRrdError(catalogue.error)}</Text>
					<Button
						onClick={() => void catalogue.refetch()}
						loading={catalogue.isFetching}
					>
						Retry capability check
					</Button>
				</Stack>
			</Alert>
		);
	}
	if (!handshake || !catalogue.data) {
		return (
			<Alert title="Checking what this engine serves">
				Waiting for the engine's capabilities before opening this view.
			</Alert>
		);
	}

	const offer: InstanceOffer = {
		operations: new Set(
			[...catalogue.data.endpoints, ...catalogue.data.websocket_endpoints].map(
				(endpoint) => endpoint.operation,
			),
		),
		capabilities: handshake.service.capabilities.map((capability) => ({
			name: capability.name,
			status: capability.status,
			limitation: capability.limitation ?? undefined,
		})),
	};
	const state = viewState(path, offer);
	if (state.kind === "unserved") {
		return (
			<Alert
				color="yellow"
				title="This engine does not serve what this view needs"
				icon={<Icon path={iconErrorCircle} />}
			>
				<Text size="sm">Missing operations: {state.operations.join(", ")}.</Text>
			</Alert>
		);
	}
	if (state.kind === "unavailable") {
		return (
			<Alert
				color="yellow"
				title="This engine marks a capability this view needs as unavailable"
				icon={<Icon path={iconErrorCircle} />}
			>
				<Stack gap={2}>
					{state.capabilities.map((capability) => (
						<Text
							size="sm"
							key={capability.name}
						>
							{capability.name}: {capability.limitation ?? "no reason stated"}
						</Text>
					))}
				</Stack>
			</Alert>
		);
	}
	return (
		<Stack gap="xs">
			{state.experimental.map((capability) => (
				<Alert
					key={capability.name}
					color="blue"
					title={`Experimental: ${capability.name}`}
				>
					<Text size="sm">{capability.limitation ?? "The engine states no limit."}</Text>
				</Alert>
			))}
			{children}
		</Stack>
	);
}
