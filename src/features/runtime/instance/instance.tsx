import { Badge, Box, Group, Paper, SimpleGrid, Text } from "@mantine/core";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { useProject } from "../project/context";
import { SessionPanel } from "../session/session";
import classes from "../style.module.scss";

/** How this window reached the project's engine, and the identity it verified. */
export function InstanceView() {
	const {
		connection,
		endpoint,
		handshake,
		handshakeQuery: query,
		session,
		foreign,
		sessionReady,
		client,
	} = useProject();
	const stages = [
		{
			label: "HTTP transport",
			detail: handshake ? `Responded at ${handshake.endpoint}` : "Awaiting liveness response",
		},
		{
			label: "Engine readiness",
			detail: handshake
				? `Cursor ${handshake.readiness.runtime_cursor} on ${handshake.readiness.backend}`
				: "Awaiting ready response",
		},
		{
			label: "RRD protocol + identity",
			detail: handshake
				? `${handshake.service.instance.id} · rrd v${handshake.service.protocol_version}`
				: "Awaiting capability negotiation",
		},
	];

	return (
		<>
			<SessionPanel
				client={client}
				connection={connection}
				endpoint={endpoint}
				handshake={handshake}
				session={session}
				foreign={foreign}
				ready={sessionReady}
			/>
			<Box>
				<PrimaryTitle fz={26}>{connection.name}</PrimaryTitle>
				<Text
					fz="sm"
					c="slate"
					mt={4}
				>
					{endpoint}
				</Text>
			</Box>
			<SimpleGrid cols={{ base: 1, md: 3 }}>
				{stages.map((stage, index) => (
					<Paper
						key={stage.label}
						p="lg"
						className={classes.stage}
					>
						<Group justify="space-between">
							<Text fw={650}>{stage.label}</Text>
							<Badge
								variant="light"
								color={handshake ? "green" : query.isError ? "red" : "gray"}
							>
								{handshake
									? "verified"
									: query.isError
										? "stopped"
										: `${index + 1}/3`}
							</Badge>
						</Group>
						<Text
							fz="sm"
							mt="sm"
						>
							{stage.detail}
						</Text>
					</Paper>
				))}
			</SimpleGrid>
			{handshake && (
				<Paper
					p="lg"
					className={classes.identity}
				>
					<Group justify="space-between">
						<Box>
							<Text
								fz="xs"
								tt="uppercase"
								c="slate"
							>
								Verified engine identity
							</Text>
							<Text
								fz="xl"
								fw={700}
							>
								{handshake.service.implementation}{" "}
								{handshake.service.implementation_version}
							</Text>
							<Text fz="sm">
								{handshake.service.deployment.deployment_form} ·{" "}
								{handshake.service.deployment.storage_profile} ·{" "}
								{handshake.service.deployment.endpoint_presentation}
							</Text>
							{handshake.service.installed_estate && (
								<Text
									fz="sm"
									ff="monospace"
								>
									{handshake.service.installed_estate.project_id} ·{" "}
									{handshake.service.installed_estate.estate_id} · configuration r
									{handshake.service.configuration.revision}
								</Text>
							)}
						</Box>
						<Badge variant="outline">
							{handshake.service.capabilities.length} capabilities
						</Badge>
					</Group>
					<Group
						gap="xs"
						mt="lg"
					>
						{handshake.service.capabilities.map((capability) => (
							<Badge
								key={capability.name}
								variant="light"
								color={capability.status === "available" ? "green" : "gray"}
							>
								{capability.name} · v{capability.contract_version}
							</Badge>
						))}
					</Group>
				</Paper>
			)}
		</>
	);
}
