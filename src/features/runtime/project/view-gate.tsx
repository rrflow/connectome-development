import { Alert, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Icon } from "~/components/Icon";
import { RrdRuntimeClient } from "~/rrflow/runtime";
import { type InstanceOffer, VIEW_NEEDS, viewState } from "~/rrflow/views";
import { iconErrorCircle } from "~/shared/assets/icons";
import { useProject } from "./context";

/**
 * Shows a view only when its engine serves what the view calls. While the
 * catalogue is unread the view renders as before; a view the engine does not
 * serve says which operations or capabilities are missing, in the engine's
 * own words, instead of failing on its first request.
 */
export function ViewGate({ path, children }: { path: string; children: ReactNode }) {
	const { endpoint, connection, handshake } = useProject();
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
		queryFn: () =>
			new RrdRuntimeClient(
				endpoint,
				connection.runtimeInstance,
				connection.runtimeSshHost,
			).catalogue(),
	});
	if (!needed || !handshake || !catalogue.data) return <>{children}</>;

	const offer: InstanceOffer = {
		operations: new Set(catalogue.data.endpoints.map((endpoint) => endpoint.operation)),
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
