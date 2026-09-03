import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	Progress,
	ScrollArea,
	SimpleGrid,
	Stack,
	Text,
} from "@mantine/core";
import { Icon, iconErrorCircle, iconRefresh } from "@rrflow/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Redirect } from "wouter";
import { PageBreadcrumbs } from "~/components/PageBreadcrumbs";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import {
	ATTUNEMENT_ESTIMATE_MINUTES,
	ATTUNEMENT_PHASES,
	AUTOMATION_PRIMITIVES,
} from "~/rrflow/attunement";
import { RrdRuntimeClient } from "~/rrflow/runtime";
import { useConfigStore } from "~/shell/stores/config";
import classes from "./style.module.scss";

export function RuntimeConnectionPage({ id }: { id: string }) {
	const connection = useConfigStore((state) =>
		state.connections.find((candidate) => candidate.id === id),
	);
	const endpoint = connection
		? `${connection.authentication.protocol}://${connection.authentication.hostname}`
		: "";
	const client = useMemo(
		() => new RrdRuntimeClient(endpoint, connection?.runtimeInstance),
		[connection?.runtimeInstance, endpoint],
	);
	const query = useQuery({
		queryKey: ["rrd-runtime-handshake", id, endpoint, connection?.runtimeInstance],
		enabled: Boolean(connection && connection.target === "runtime"),
		queryFn: () => client.handshake(),
		retry: false,
	});

	if (connection?.target !== "runtime") {
		return <Redirect to="/overview" />;
	}

	const handshake = query.data;
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
		<Box
			flex={1}
			pos="relative"
		>
			<ScrollArea
				pos="absolute"
				inset={0}
				type="scroll"
				scrollbars="y"
			>
				<Stack
					px="xl"
					py="lg"
					mx="auto"
					maw={1320}
					pb={72}
				>
					<PageBreadcrumbs
						items={[
							{ label: "Connectome", href: "/overview" },
							{ label: "RRD runtimes" },
							{ label: connection.name },
						]}
					/>

					<Group
						align="flex-start"
						justify="space-between"
					>
						<Box>
							<Group gap="xs">
								<Badge
									variant="dot"
									color={handshake ? "green" : query.isError ? "red" : "gray"}
								>
									{handshake
										? "RRD connected"
										: query.isError
											? "Rejected"
											: "Negotiating"}
								</Badge>
								<Badge
									variant="light"
									color="violet"
								>
									HTTP first
								</Badge>
							</Group>
							<PrimaryTitle
								fz={32}
								mt="xs"
							>
								{handshake?.service.instance.id ?? connection.name}
							</PrimaryTitle>
							<Text
								ff="monospace"
								fz="sm"
								mt={4}
							>
								{endpoint}
							</Text>
						</Box>
						<Button
							variant="light"
							leftSection={<Icon path={iconRefresh} />}
							onClick={() => query.refetch()}
							loading={query.isFetching}
						>
							Reconnect
						</Button>
					</Group>

					{query.isError && (
						<Alert
							color="red"
							title="RRD handshake failed"
							icon={<Icon path={iconErrorCircle} />}
						>
							{query.error instanceof Error
								? query.error.message
								: "Unknown RRD connection error"}
						</Alert>
					)}

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
										{handshake.service.deployment_mode} deployment
									</Text>
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

					<Box mt="md">
						<Group justify="space-between">
							<Box>
								<Text
									fz="xl"
									fw={650}
									c="bright"
								>
									Existing-project attunement
								</Text>
								<Text>
									Designed as a resumable {ATTUNEMENT_ESTIMATE_MINUTES.minimum}–
									{ATTUNEMENT_ESTIMATE_MINUTES.maximum} minute engine job.
								</Text>
							</Box>
							<Badge
								variant="outline"
								color="gray"
							>
								Contract pending
							</Badge>
						</Group>
						<Progress
							value={handshake ? 100 / ATTUNEMENT_PHASES.length : 0}
							mt="md"
							color="violet"
						/>
					</Box>

					<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
						{ATTUNEMENT_PHASES.map((phase) => (
							<Paper
								key={phase.id}
								p="md"
								className={classes.phase}
							>
								<Group justify="space-between">
									<Text fw={650}>{phase.label}</Text>
									<Badge
										variant="light"
										color={phase.state === "implemented" ? "green" : "gray"}
									>
										{phase.state === "implemented" ? "available" : "planned"}
									</Badge>
								</Group>
								<Text
									fz="sm"
									mt="xs"
								>
									{phase.description}
								</Text>
							</Paper>
						))}
					</SimpleGrid>

					<Paper
						p="lg"
						className={classes.boundary}
					>
						<Group justify="space-between">
							<Box>
								<Text
									fz="lg"
									fw={650}
								>
									Mesh discovery boundary
								</Text>
								<Text fz="sm">
									Zuul Zero or shippin.ai mesh may resolve a devspace endpoint;
									Connectome still performs this RRD HTTP handshake and never
									treats network reachability as engine identity.
								</Text>
							</Box>
							<Badge variant="outline">Adapter pending</Badge>
						</Group>
						<SimpleGrid
							cols={{ base: 1, sm: 2, lg: 4 }}
							mt="lg"
						>
							{AUTOMATION_PRIMITIVES.map((primitive) => (
								<Box
									key={primitive.name}
									className={classes.primitive}
								>
									<Text fw={650}>{primitive.name}</Text>
									<Text fz="sm">{primitive.contract}</Text>
								</Box>
							))}
						</SimpleGrid>
					</Paper>
				</Stack>
			</ScrollArea>
		</Box>
	);
}
