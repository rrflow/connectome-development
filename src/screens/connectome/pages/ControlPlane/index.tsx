import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	ScrollArea,
	SimpleGrid,
	Skeleton,
	Stack,
	Text,
	ThemeIcon,
} from "@mantine/core";
import { Icon, iconDatabase, iconErrorCircle, iconRefresh } from "@surrealdb/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, Redirect } from "wouter";
import { PageBreadcrumbs } from "~/components/PageBreadcrumbs";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { RRFlowControlPlaneClient, type RRFlowManagedInstance } from "~/rrflow/control-plane";
import { useConfigStore } from "~/shell/stores/config";
import classes from "./style.module.scss";

const STATUS_COLOR: Record<RRFlowManagedInstance["status"], string> = {
	online: "green",
	degraded: "yellow",
	offline: "red",
	provisioning: "blue",
	upgrading: "violet",
};

export function ControlPlanePage({ id }: { id: string }) {
	const connection = useConfigStore((state) =>
		state.connections.find((candidate) => candidate.id === id),
	);

	const endpoint = connection
		? `${connection.authentication.protocol}://${connection.authentication.hostname}`
		: "";
	const client = useMemo(
		() => new RRFlowControlPlaneClient(endpoint, connection?.authentication.token ?? ""),
		[connection?.authentication.token, endpoint],
	);
	const query = useQuery({
		queryKey: ["rrflow-control-plane", id, endpoint],
		enabled: Boolean(connection && connection.target === "control-plane"),
		queryFn: async () => {
			const handshake = await client.handshake();
			const instances = await client.listInstances();
			return { handshake, instances };
		},
	});

	if (connection?.target !== "control-plane") {
		return <Redirect to="/overview" />;
	}

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
					maw={1280}
				>
					<PageBreadcrumbs
						items={[
							{ label: "Connectome", href: "/overview" },
							{ label: "Enterprise control planes" },
							{ label: connection.name },
						]}
					/>

					<Group
						align="flex-start"
						justify="space-between"
					>
						<Box>
							<PrimaryTitle fz={32}>{connection.name}</PrimaryTitle>
							<Text mt={4}>RRFlow enterprise fleet and deployment control</Text>
						</Box>
						<Button
							variant="light"
							leftSection={<Icon path={iconRefresh} />}
							onClick={() => query.refetch()}
							loading={query.isFetching}
						>
							Refresh
						</Button>
					</Group>

					{query.isError && (
						<Alert
							color="red"
							title="RRFlow control-plane handshake failed"
							icon={<Icon path={iconErrorCircle} />}
						>
							{query.error instanceof Error
								? query.error.message
								: "Unknown control error"}
						</Alert>
					)}

					{query.data && (
						<Paper
							className={classes.handshake}
							p="lg"
						>
							<Group
								justify="space-between"
								align="flex-start"
							>
								<Box>
									<Group gap="xs">
										<Badge
											color="green"
											variant="dot"
										>
											RRFlow native
										</Badge>
										<Badge
											color="violet"
											variant="light"
										>
											Control protocol v{query.data.handshake.version}
										</Badge>
									</Group>
									<Text
										fz="xl"
										fw={650}
										mt="sm"
									>
										{query.data.handshake.name}
									</Text>
									<Text
										fz="sm"
										ff="monospace"
									>
										{endpoint}
									</Text>
								</Box>
								<Badge variant="outline">
									{query.data.instances.length} instance
									{query.data.instances.length === 1 ? "" : "s"}
								</Badge>
							</Group>
							<Group
								gap="xs"
								mt="lg"
							>
								{query.data.handshake.capabilities.map((capability) => (
									<Badge
										key={capability}
										color="gray"
										variant="light"
									>
										{capability}
									</Badge>
								))}
							</Group>
						</Paper>
					)}

					{query.isLoading ? (
						<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
							{[0, 1, 2].map((slot) => (
								<Skeleton
									key={slot}
									h={190}
									radius="md"
								/>
							))}
						</SimpleGrid>
					) : (
						<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
							{query.data?.instances.map((instance) => (
								<Paper
									key={instance.id}
									className={classes.instance}
									p="lg"
								>
									<Group
										justify="space-between"
										wrap="nowrap"
									>
										<ThemeIcon
											color="violet"
											variant="light"
											size="lg"
										>
											<Icon path={iconDatabase} />
										</ThemeIcon>
										<Badge
											color={STATUS_COLOR[instance.status]}
											variant="dot"
										>
											{instance.status}
										</Badge>
									</Group>
									<Text
										fz="lg"
										fw={650}
										mt="md"
									>
										{instance.name}
									</Text>
									<Text
										fz="xs"
										ff="monospace"
										lineClamp={1}
									>
										{instance.endpoint}
									</Text>
									<Group
										mt="lg"
										gap="xs"
									>
										{instance.region && (
											<Badge variant="light">{instance.region}</Badge>
										)}
										{instance.version && (
											<Badge variant="light">v{instance.version}</Badge>
										)}
									</Group>
									<Link
										href={`/connections/create?runtime=${encodeURIComponent(instance.endpoint)}`}
									>
										<Button
											fullWidth
											mt="lg"
											variant="light"
										>
											Open runtime
										</Button>
									</Link>
								</Paper>
							))}
						</SimpleGrid>
					)}
				</Stack>
			</ScrollArea>
		</Box>
	);
}
