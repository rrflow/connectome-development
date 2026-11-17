import { Badge, Box, Group, Loader, Paper, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError, type RrdCapability } from "~/rrflow/runtime";
import { Stat } from "../components/stat";
import { useProject } from "../project/context";
import { formatCount, formatTime } from "../utils/format";

type CapabilityStatus = RrdCapability["status"];

/** Groups in the order a person cares about: what works, what is new, what is off. */
const STATUS_ORDER: CapabilityStatus[] = ["available", "experimental", "unavailable"];

const STATUS: Record<CapabilityStatus, { title: string; meaning: string; color: string }> = {
	available: {
		title: "Available",
		meaning: "The engine reports these as ready to use.",
		color: "green",
	},
	experimental: {
		title: "Experimental",
		meaning: "The engine offers these, and marks them as still being proven.",
		color: "yellow",
	},
	unavailable: {
		title: "Unavailable",
		meaning: "The engine knows these and reports that it does not offer them here.",
		color: "gray",
	},
};

const words = (value: string) => value.replaceAll("_", " ");

/** What the project's engine says it can do, straight from its handshake. */
export function CapabilitiesView() {
	const { handshake, handshakeQuery } = useProject();
	const service = handshake?.service;

	return (
		<Stack gap="lg">
			<Box>
				<PrimaryTitle>Capabilities</PrimaryTitle>
				<Text mt={4}>
					What this project's engine says it can do, and how it is set up. The engine
					reports this about itself when the app first reaches it; no sign-in is needed.
				</Text>
			</Box>

			{!service && handshakeQuery.isError && (
				<Text c="slate">
					The engine did not answer, so there is nothing to list:{" "}
					{describeRrdError(handshakeQuery.error)}
				</Text>
			)}
			{!service && !handshakeQuery.isError && (
				<Group>
					<Loader size="sm" />
					<Text c="slate">Waiting for the engine to describe itself…</Text>
				</Group>
			)}

			{service && handshake && (
				<>
					<Text
						fz="sm"
						c="slate"
					>
						Read {formatTime(handshake.connected_at_unix_ms)} from {handshake.endpoint}
						{handshakeQuery.isError
							? ". The latest attempt to reach the engine failed, so this is its earlier answer."
							: "."}
					</Text>
					<SimpleGrid cols={{ base: 2, md: 3, xl: 6 }}>
						<Stat
							label="Engine"
							value={`${service.implementation} ${service.implementation_version}`}
							title={`${service.implementation} ${service.implementation_version}`}
						/>
						<Stat
							label="Protocol"
							value={`${service.protocol} v${service.protocol_version}`}
						/>
						<Stat
							label="Deployment form"
							value={words(service.deployment.deployment_form)}
							title={service.deployment.deployment_form}
						/>
						<Stat
							label="Storage profile"
							value={words(service.deployment.storage_profile)}
							title={service.deployment.storage_profile}
						/>
						<Stat
							label="Reached through"
							value={words(service.deployment.endpoint_presentation)}
							title={service.deployment.endpoint_presentation}
						/>
						<Stat
							label="Deployment contract"
							value={`v${service.deployment.contract_version}`}
						/>
					</SimpleGrid>

					{service.capabilities.length === 0 && (
						<Text c="slate">The engine reported zero capabilities.</Text>
					)}
					{STATUS_ORDER.map((status) => {
						const group = service.capabilities.filter(
							(capability) => capability.status === status,
						);
						return group.length > 0 ? (
							<CapabilityGroup
								key={status}
								status={status}
								capabilities={group}
							/>
						) : null;
					})}
				</>
			)}
		</Stack>
	);
}

interface CapabilityGroupProps {
	status: CapabilityStatus;
	capabilities: RrdCapability[];
}

function CapabilityGroup({ status, capabilities }: CapabilityGroupProps) {
	const { title, meaning, color } = STATUS[status];

	return (
		<Paper p="md">
			<Group gap="xs">
				<Badge
					variant="light"
					color={color}
				>
					{title} · {capabilities.length}
				</Badge>
				<Text fz="sm">{meaning}</Text>
			</Group>
			<Table
				fz="sm"
				mt="sm"
				striped
			>
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Capability</Table.Th>
						<Table.Th>Contract version</Table.Th>
						<Table.Th>Limits the engine states</Table.Th>
						<Table.Th>Limitation the engine states</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{capabilities.map((capability) => {
						const limits = Object.entries(capability.limits ?? {});
						return (
							<Table.Tr key={capability.name}>
								<Table.Td ff="monospace">{capability.name}</Table.Td>
								<Table.Td>v{capability.contract_version}</Table.Td>
								<Table.Td>
									{limits.length === 0
										? "None stated"
										: limits.map(([name, value]) => (
												<Text
													key={name}
													fz="sm"
												>
													{words(name)}: {formatCount(value)}
												</Text>
											))}
								</Table.Td>
								<Table.Td>{capability.limitation || "None stated"}</Table.Td>
							</Table.Tr>
						);
					})}
				</Table.Tbody>
			</Table>
		</Paper>
	);
}
