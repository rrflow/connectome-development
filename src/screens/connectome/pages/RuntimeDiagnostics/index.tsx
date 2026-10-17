import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	NumberInput,
	Paper,
	ScrollArea,
	SegmentedControl,
	Select,
	SimpleGrid,
	Slider,
	Stack,
	Text,
	Textarea,
	UnstyledButton,
} from "@mantine/core";
import { Icon, iconErrorCircle, iconRefresh } from "@surrealdb/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Redirect } from "wouter";
import { PageBreadcrumbs } from "~/components/PageBreadcrumbs";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import {
	type LaunchVyrmFlight,
	VyrmDiagnosticsClient,
	type VyrmFlight,
} from "~/rrflow/diagnostics";
import { useConfigStore } from "~/shell/stores/config";
import classes from "./style.module.scss";

const LANE_ORDER = ["context", "routing", "model", "tools", "verification", "outcome"];
const MATURITY_COLOR = {
	alpha: "green",
	partial: "yellow",
	experimental: "violet",
	planned: "gray",
} as const;

function clampCursor(flight: VyrmFlight | undefined, cursor: number) {
	return Math.max(0, Math.min(cursor, Math.max(0, (flight?.events.length ?? 1) - 1)));
}

export function RuntimeDiagnosticsPage({ id }: { id: string }) {
	const connection = useConfigStore((state) =>
		state.connections.find((candidate) => candidate.id === id),
	);
	const endpoint = connection
		? `${connection.authentication.protocol}://${connection.authentication.hostname}`
		: "";
	const client = useMemo(() => new VyrmDiagnosticsClient(endpoint), [endpoint]);
	const queryClient = useQueryClient();
	const runtime = useQuery({
		queryKey: ["vyrm-diagnostics", id, endpoint],
		enabled: Boolean(connection && connection.target === "diagnostics"),
		queryFn: () => client.snapshot(),
		refetchInterval: 2_000,
	});
	const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
	const [cursor, setCursor] = useState(0);
	const [playing, setPlaying] = useState<0 | -1 | 1>(0);
	const [speed, setSpeed] = useState(1);
	const [draft, setDraft] = useState<LaunchVyrmFlight>({
		prompt: "Trace this request through context, routing, model, tools, verification, and outcome with evidence for every observable transition.",
		provider: "observe",
		context_mode: "pruned",
		budget: 1_500,
		acceptance_marker: "",
		reasoning_profile: "default",
	});
	const flights = runtime.data?.flights ?? [];
	const selectedFlight = flights.find((flight) => flight.id === selectedFlightId) ?? flights[0];
	const selectedEvent = selectedFlight?.events[clampCursor(selectedFlight, cursor)];

	useEffect(() => {
		if (!selectedFlightId && flights[0]) {
			setSelectedFlightId(flights[0].id);
			setCursor(Math.max(0, flights[0].events.length - 1));
		}
	}, [flights, selectedFlightId]);

	useEffect(() => {
		if (!playing || !selectedFlight?.events.length) return;
		const timer = window.setInterval(
			() => {
				setCursor((current) => {
					const next = clampCursor(selectedFlight, current + playing);
					if (next === current) setPlaying(0);
					return next;
				});
			},
			Math.max(80, 700 / speed),
		);
		return () => window.clearInterval(timer);
	}, [playing, selectedFlight, speed]);

	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: ["vyrm-diagnostics", id, endpoint] });
	};
	const launch = useMutation({
		mutationFn: () => client.launch(draft),
		onSuccess: async (flight) => {
			setSelectedFlightId(flight.id);
			setCursor(0);
			await refresh();
		},
	});
	const seedDemos = useMutation({
		mutationFn: () => client.seedDemos(),
		onSuccess: async (seeded) => {
			setSelectedFlightId(seeded[0]?.id ?? null);
			setCursor(0);
			await refresh();
		},
	});
	const mutationError = launch.error ?? seedDemos.error;

	if (connection?.target !== "diagnostics") {
		return <Redirect to="/overview" />;
	}

	const maxElapsed = Math.max(
		1,
		...(selectedFlight?.events.map((event) => event.elapsed_ms) ?? [1]),
	);
	const laneFor = (stage: string) => {
		const normalized = stage.toLowerCase();
		return Math.max(
			0,
			LANE_ORDER.findIndex((lane) => normalized.includes(lane)),
		);
	};

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
					maw={1480}
				>
					<PageBreadcrumbs
						items={[
							{ label: "Connectome", href: "/overview" },
							{ label: "Vyrm diagnostics" },
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
									color={runtime.data ? "green" : "gray"}
								>
									{runtime.data ? "Runtime connected" : "Negotiating"}
								</Badge>
								{runtime.data && (
									<Badge
										variant="light"
										color="violet"
									>
										{runtime.data.capabilities.protocol} v
										{runtime.data.capabilities.version}
									</Badge>
								)}
							</Group>
							<PrimaryTitle
								fz={32}
								mt="xs"
							>
								{runtime.data?.instance.id ?? connection.name}
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
							onClick={() => refresh()}
							loading={runtime.isFetching}
						>
							Refresh
						</Button>
					</Group>

					{runtime.isError && (
						<Alert
							color="red"
							title="Vyrm diagnostics handshake failed"
							icon={<Icon path={iconErrorCircle} />}
						>
							{runtime.error instanceof Error
								? runtime.error.message
								: "Unknown diagnostics error"}
						</Alert>
					)}
					{mutationError && (
						<Alert
							color="red"
							title="Prompt flight was rejected"
							icon={<Icon path={iconErrorCircle} />}
						>
							{mutationError instanceof Error
								? mutationError.message
								: "Unknown flight error"}
						</Alert>
					)}

					{runtime.data && (
						<>
							<SimpleGrid cols={{ base: 2, md: 5 }}>
								{[
									["Runtime cursor", runtime.data.health.runtime_cursor],
									["Persisted flights", flights.length],
									["Current claims", runtime.data.health.current_claims],
									["Vector artifacts", runtime.data.health.vector_artifacts],
									["Storage", runtime.data.health.storage_backend],
								].map(([label, value]) => (
									<Paper
										key={label}
										p="md"
										className={classes.metric}
									>
										<Text
											fz="xs"
											tt="uppercase"
											c="slate"
										>
											{label}
										</Text>
										<Text
											fz="xl"
											fw={700}
											mt={6}
										>
											{value}
										</Text>
									</Paper>
								))}
							</SimpleGrid>

							<Paper
								p="lg"
								className={classes.launcher}
							>
								<Group
									align="flex-end"
									wrap="nowrap"
								>
									<Textarea
										label="Prompt experiment"
										value={draft.prompt}
										onChange={(event) =>
											setDraft({ ...draft, prompt: event.target.value })
										}
										autosize
										minRows={3}
										maxRows={7}
										flex={1}
									/>
									<Stack
										w={230}
										gap="xs"
									>
										<Select
											label="Runner"
											value={draft.provider}
											data={runtime.data.capabilities.providers}
											onChange={(value) =>
												value && setDraft({ ...draft, provider: value })
											}
										/>
										<Select
											label="Context"
											value={draft.context_mode}
											data={["fresh", "pruned", "full"]}
											onChange={(value) =>
												value &&
												setDraft({
													...draft,
													context_mode:
														value as LaunchVyrmFlight["context_mode"],
												})
											}
										/>
										<NumberInput
											label="Context budget"
											value={draft.budget}
											min={128}
											max={64_000}
											onChange={(value) =>
												setDraft({
													...draft,
													budget: Number(value) || 1_500,
												})
											}
										/>
									</Stack>
								</Group>
								<Group
									mt="md"
									justify="space-between"
								>
									<SegmentedControl
										value={draft.reasoning_profile}
										onChange={(value) =>
											setDraft({
												...draft,
												reasoning_profile:
													value as LaunchVyrmFlight["reasoning_profile"],
											})
										}
										data={["default", "high", "extreme", "ultra"]}
									/>
									<Group>
										<Button
											variant="light"
											onClick={() => seedDemos.mutate()}
											loading={seedDemos.isPending}
										>
											Load weak / strong demos
										</Button>
										<Button
											onClick={() => launch.mutate()}
											loading={launch.isPending}
											disabled={!draft.prompt.trim()}
										>
											Launch recorded flight
										</Button>
									</Group>
								</Group>
							</Paper>

							<SimpleGrid
								cols={{ base: 1, lg: 4 }}
								spacing="md"
							>
								<Paper className={classes.flightList}>
									<Box
										p="md"
										className={classes.sectionHead}
									>
										<Text fw={700}>Past runs</Text>
										<Badge variant="light">{flights.length}</Badge>
									</Box>
									<ScrollArea h={520}>
										<Stack gap={0}>
											{flights.map((flight) => (
												<UnstyledButton
													key={flight.id}
													className={`${classes.flightRow} ${flight.id === selectedFlight?.id ? classes.active : ""}`}
													onClick={() => {
														setSelectedFlightId(flight.id);
														setCursor(
															Math.max(0, flight.events.length - 1),
														);
														setPlaying(0);
													}}
												>
													<span>
														<b>
															{flight.demo_role ??
																flight.reasoning_profile}
														</b>
														<small>
															{flight.provider} ·{" "}
															{flight.context_mode}
														</small>
													</span>
													<code>{flight.events.length} packets</code>
												</UnstyledButton>
											))}
											{!flights.length && (
												<Text
													p="lg"
													c="slate"
												>
													No prompt flights recorded yet.
												</Text>
											)}
										</Stack>
									</ScrollArea>
								</Paper>

								<Paper
									className={classes.replay}
									style={{ gridColumn: "span 3" }}
								>
									<Box
										p="md"
										className={classes.sectionHead}
									>
										<Box>
											<Text fw={700}>Observable event replay</Text>
											<Text
												fz="xs"
												c="slate"
											>
												Persisted packets only — no hidden chain-of-thought
											</Text>
										</Box>
										<Badge
											color={
												selectedFlight?.status === "failed"
													? "red"
													: "green"
											}
											variant="dot"
										>
											{selectedFlight?.status ?? "idle"}
										</Badge>
									</Box>
									<Box className={classes.stage}>
										{LANE_ORDER.map((lane, laneIndex) => (
											<Box
												className={classes.lane}
												key={lane}
											>
												<em>{lane}</em>
												<span />
												{selectedFlight?.events.map((event, eventIndex) =>
													eventIndex <= cursor &&
													laneFor(event.stage) === laneIndex ? (
														<UnstyledButton
															title={`${event.kind}: ${event.label}`}
															key={event.ordinal}
															className={`${classes.packet} ${eventIndex === cursor ? classes.current : ""}`}
															style={{
																left: `${8 + (event.elapsed_ms / maxElapsed) * 86}%`,
															}}
															onClick={() => {
																setCursor(eventIndex);
																setPlaying(0);
															}}
														/>
													) : null,
												)}
											</Box>
										))}
									</Box>
									<Stack
										p="md"
										gap="xs"
									>
										<Group
											justify="center"
											gap="xs"
										>
											<Button
												size="xs"
												variant="light"
												onClick={() => {
													setCursor(0);
													setPlaying(0);
												}}
											>
												│◀
											</Button>
											<Button
												size="xs"
												variant={playing === -1 ? "filled" : "light"}
												onClick={() => setPlaying(playing === -1 ? 0 : -1)}
											>
												◀
											</Button>
											<Button
												size="xs"
												variant="light"
												onClick={() => setPlaying(0)}
											>
												Ⅱ
											</Button>
											<Button
												size="xs"
												variant={playing === 1 ? "filled" : "light"}
												onClick={() => setPlaying(playing === 1 ? 0 : 1)}
											>
												▶
											</Button>
											<Button
												size="xs"
												variant="light"
												onClick={() => {
													setCursor(
														Math.max(
															0,
															(selectedFlight?.events.length ?? 1) -
																1,
														),
													);
													setPlaying(0);
												}}
											>
												▶│
											</Button>
											<Select
												size="xs"
												w={86}
												value={String(speed)}
												data={(
													runtime.data.capabilities.replay.speeds ?? [1]
												).map((value) => ({
													value: String(value),
													label: `${value}×`,
												}))}
												onChange={(value) => setSpeed(Number(value) || 1)}
											/>
										</Group>
										<Slider
											min={0}
											max={Math.max(
												0,
												(selectedFlight?.events.length ?? 1) - 1,
											)}
											step={1}
											value={clampCursor(selectedFlight, cursor)}
											onChange={(value) => {
												setCursor(value);
												setPlaying(0);
											}}
											disabled={!selectedFlight?.events.length}
										/>
										<Paper
											p="md"
											className={classes.eventDetail}
										>
											<Group justify="space-between">
												<Badge variant="light">
													{selectedEvent?.stage ?? "waiting"}
												</Badge>
												<Text
													ff="monospace"
													fz="xs"
												>
													packet{" "}
													{selectedEvent ? selectedEvent.ordinal + 1 : 0}{" "}
													/ {selectedFlight?.events.length ?? 0} ·{" "}
													{selectedEvent?.elapsed_ms ?? 0} ms
												</Text>
											</Group>
											<Text
												fw={700}
												mt="sm"
											>
												{selectedEvent?.label ?? "Select or launch a run"}
											</Text>
											<Text
												fz="sm"
												mt={4}
											>
												{selectedEvent?.detail ??
													"The native client will replay every retained observable event here."}
											</Text>
										</Paper>
									</Stack>
								</Paper>
							</SimpleGrid>

							<Box>
								<Group
									justify="space-between"
									mb="sm"
								>
									<Box>
										<Text fw={700}>Engine capability ledger</Text>
										<Text fz="sm">
											Executable evidence and current limits from the runtime
											itself.
										</Text>
									</Box>
									<Badge variant="outline">
										{runtime.data.capabilities.engine.length} capabilities
									</Badge>
								</Group>
								<SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
									{runtime.data.capabilities.engine.map((capability) => (
										<Paper
											key={capability.id}
											p="md"
											className={classes.capability}
										>
											<Group justify="space-between">
												<Text
													fz="xs"
													tt="uppercase"
													c="slate"
												>
													{capability.category}
												</Text>
												<Badge
													color={MATURITY_COLOR[capability.maturity]}
													variant="light"
												>
													{capability.maturity}
												</Badge>
											</Group>
											<Text
												fw={700}
												mt="sm"
											>
												{capability.label}
											</Text>
											<Text
												fz="sm"
												mt={4}
											>
												{capability.summary}
											</Text>
											<Text
												fz="xs"
												mt="md"
												c="green"
											>
												<b>Evidence:</b> {capability.evidence}
											</Text>
											<Text
												fz="xs"
												mt={6}
												c="slate"
											>
												<b>Limit:</b> {capability.limitation}
											</Text>
										</Paper>
									))}
								</SimpleGrid>
							</Box>
						</>
					)}
				</Stack>
			</ScrollArea>
		</Box>
	);
}
