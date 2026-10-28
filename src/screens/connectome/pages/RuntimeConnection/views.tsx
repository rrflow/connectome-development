import { Badge, Group, List, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { connectionProject } from "~/rrflow/instances";
import { type RrdHandshake, RrdRuntimeClient } from "~/rrflow/runtime";
import {
	type CapabilityState,
	type InstanceOffer,
	type ViewId,
	type ViewState,
	view,
	viewState,
} from "~/rrflow/views";
import { useDatabaseStore } from "~/stores/database";
import type { Connection, ProjectInstance } from "~/types";

/** A ready instance's offer, with each operation's one-line summary. */
export interface ProjectOffer extends InstanceOffer {
	summaries: ReadonlyMap<string, string>;
}

export interface ProjectViews {
	state: (id: ViewId) => ViewState;
	offer: ProjectOffer | undefined;
}

/**
 * Each view's state for one project (sprint 009, step F4b). A local project's
 * instance comes from the native registry; a connection that is not a local
 * project has no lifecycle here, so its public handshake stands in. The offer
 * is the instance's public catalogue and the capabilities its handshake read.
 */
export function useProjectViews({
	connection,
	endpoint,
	handshake,
	handshakeFailed,
}: {
	connection: Connection | undefined;
	endpoint: string;
	handshake: RrdHandshake | undefined;
	handshakeFailed: boolean;
}): ProjectViews {
	const project = connection ? connectionProject(connection) : undefined;
	const tracked = useDatabaseStore((state) => (project ? state.instances[project] : undefined));
	const statusRead = useDatabaseStore((state) => state.statusRead);
	const instance: ProjectInstance | undefined = project
		? tracked
		: handshake
			? {
					project: endpoint,
					state: "ready",
					origin: "elsewhere",
					detail: "It answered the public handshake.",
					revision: 0,
				}
			: handshakeFailed
				? {
						project: endpoint,
						state: "failed",
						origin: "elsewhere",
						detail: "It did not answer the public handshake.",
						revision: 0,
					}
				: undefined;
	const ready = instance?.state === "ready";
	const catalogue = useQuery({
		queryKey: ["rrd-operation-catalogue", endpoint],
		enabled: ready && Boolean(endpoint),
		queryFn: () => new RrdRuntimeClient(endpoint, handshake?.service.instance.id).catalogue(),
	});
	const offer = useMemo((): ProjectOffer | undefined => {
		if (!catalogue.data || !handshake) return undefined;
		const operations = [...catalogue.data.endpoints, ...catalogue.data.websocket_endpoints];
		return {
			operations: new Set(operations.map((operation) => operation.operation)),
			summaries: new Map(
				operations.map((operation) => [operation.operation, operation.summary]),
			),
			capabilities: handshake.service.capabilities.map(
				(capability): CapabilityState => ({
					name: capability.name,
					status: capability.status,
					limitation: capability.limitation ?? undefined,
				}),
			),
		};
	}, [catalogue.data, handshake]);
	return {
		offer,
		state: (id) =>
			project && !statusRead
				? { kind: "instance", state: "unknown", detail: "Reading this project's instance." }
				: viewState(view(id), instance, offer),
	};
}

const INSTANCE_LABEL: Record<string, string> = {
	starting: "Instance starting",
	stopping: "Instance stopping",
	stopped: "Instance stopped",
	failed: "Instance failed",
	unknown: "Reading the instance",
};

/** A view's state in a few words, for a card that leads to it. */
export function stateLine(state: ViewState): string | undefined {
	switch (state.kind) {
		case "ready":
			return undefined;
		case "instance":
			return INSTANCE_LABEL[state.state] ?? "Instance not ready";
		case "planned":
			return "Not in Connectome yet";
		case "unserved":
			return "Not served by this instance";
		case "unavailable":
			return `Unavailable: ${state.capabilities.map((capability) => capability.name).join(", ")}`;
	}
}

function Capabilities({ capabilities }: { capabilities: readonly CapabilityState[] }) {
	if (capabilities.length === 0) return null;
	return (
		<List
			size="sm"
			spacing={4}
		>
			{capabilities.map((capability) => (
				<List.Item key={capability.name}>
					<Text
						span
						ff="monospace"
						size="sm"
					>
						{capability.name}
					</Text>{" "}
					<Text
						span
						size="sm"
						c={capability.status === "unavailable" ? "red" : "dimmed"}
					>
						{capability.status}
						{capability.limitation ? `: ${capability.limitation}` : ""}
					</Text>
				</List.Item>
			))}
		</List>
	);
}

/**
 * What a view that is not ready shows, in the engine's words where the engine
 * states them: the instance's lifecycle, what it serves for a view Connectome
 * has not built yet, or the operation or capability it lacks.
 */
export function ViewStateNotice({
	state,
	offer,
}: {
	state: ViewState;
	offer: ProjectOffer | undefined;
}) {
	switch (state.kind) {
		case "ready":
			return null;
		case "instance":
			return (
				<Group gap="xs">
					<Badge
						color={state.state === "failed" ? "red" : "gray"}
						variant="light"
					>
						{INSTANCE_LABEL[state.state] ?? "Instance not ready"}
					</Badge>
					<Text size="sm">{state.detail}</Text>
				</Group>
			);
		case "planned":
			return (
				<Stack gap="xs">
					<Badge
						color="gray"
						variant="light"
					>
						Not in Connectome yet
					</Badge>
					{state.served.length === 0 ? (
						<Text size="sm">RRFlow serves no operation for this yet.</Text>
					) : (
						<>
							<Text size="sm">
								This instance serves what this view will use; Connectome does not
								show it yet.
							</Text>
							<List
								size="sm"
								spacing={4}
							>
								{state.served.map((operation) => (
									<List.Item key={operation}>
										{offer?.summaries.get(operation) ?? operation}{" "}
										<Text
											span
											ff="monospace"
											size="xs"
											c="dimmed"
										>
											{operation}
										</Text>
									</List.Item>
								))}
							</List>
						</>
					)}
					<Capabilities capabilities={state.capabilities} />
				</Stack>
			);
		case "unserved":
			return (
				<Stack gap="xs">
					<Badge
						color="orange"
						variant="light"
					>
						Not served by this instance
					</Badge>
					<Text size="sm">
						This instance's catalogue lacks {state.operations.join(", ")}.
					</Text>
				</Stack>
			);
		case "unavailable":
			return (
				<Stack gap="xs">
					<Badge
						color="red"
						variant="light"
					>
						Unavailable on this instance
					</Badge>
					<Capabilities capabilities={state.capabilities} />
				</Stack>
			);
	}
}
