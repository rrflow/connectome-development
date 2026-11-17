import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Loader,
	NavLink,
	Paper,
	ScrollArea,
	SimpleGrid,
	Stack,
	Text,
} from "@mantine/core";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import type { RrdPromptFlightDetailView } from "~/rrflow/session";
import { Stat } from "../components/stat";
import { useProject } from "../project/context";
import { formatCount, formatSize, formatTime, shortDigest } from "../utils/format";
import { FlightEventMap } from "../workbench/visuals";
import {
	FLIGHTS_REFRESH_MS,
	type FlightPage,
	useFlightDetail,
	useFlightPage,
	useFlightSelection,
} from "./use-flights";

/** Moves between the pages of flights the engine returns. */
export function FlightPager({ page }: { page: FlightPage }) {
	const { snapshot, afterCursor, next, first } = page;
	if (!snapshot.data || (!next && !first)) return null;
	return (
		<Stack gap="xs">
			<Text
				size="xs"
				c="dimmed"
			>
				{afterCursor === 0
					? "These are the first flights the engine recorded."
					: `These flights come after cursor ${formatCount(afterCursor)}.`}
				{snapshot.data.truncated && " The engine holds newer flights on the next page."}
			</Text>
			<Group gap="xs">
				<Button
					variant="light"
					size="xs"
					disabled={!first}
					onClick={() => first?.()}
				>
					First page
				</Button>
				<Button
					variant="light"
					size="xs"
					disabled={!next}
					onClick={() => next?.()}
				>
					Next page
				</Button>
			</Group>
		</Stack>
	);
}

/** Every prompt flight the engine recorded, and what one of them did. */
export function FlightsView() {
	const { session } = useProject();
	const page = useFlightPage();
	const { snapshot } = page;
	// The engine answers oldest first; a person looks for the latest prompt.
	const flights = [...(snapshot.data?.flights ?? [])].reverse();
	const [selected, select] = useFlightSelection(flights[0]?.flight_id ?? null);
	const detail = useFlightDetail(selected);
	if (!session) return null;

	return (
		<Stack gap="lg">
			<Box>
				<PrimaryTitle>Prompt flights</PrimaryTitle>
				<Text mt="xs">
					A prompt flight is one prompt the engine recorded as it passed through: what was
					asked, how much context the engine gathered for it, and each step it took. The
					list refreshes every {FLIGHTS_REFRESH_MS / 1000} seconds.
				</Text>
			</Box>
			{snapshot.isPending && (
				<Group>
					<Loader size="sm" />
					<Text size="sm">Reading the recorded flights…</Text>
				</Group>
			)}
			{snapshot.isError && (
				<Alert
					color="red"
					title="The flights could not be read"
				>
					{describeRrdError(snapshot.error)}
				</Alert>
			)}
			{snapshot.data && (
				<Group
					align="flex-start"
					gap="lg"
					wrap="nowrap"
				>
					<Paper
						withBorder
						p="sm"
						w={320}
						style={{ flexShrink: 0 }}
					>
						<Stack gap="sm">
							<Text fw={700}>
								{formatCount(flights.length)}{" "}
								{flights.length === 1 ? "flight" : "flights"}, newest first
							</Text>
							{flights.length === 0 && (
								<Text size="sm">
									The engine returned zero flights
									{page.afterCursor === 0 ? "" : " on this page"}.
								</Text>
							)}
							<ScrollArea.Autosize mah={520}>
								{flights.map((flight) => (
									<NavLink
										key={flight.flight_id}
										active={flight.flight_id === selected}
										onClick={() => select(flight.flight_id)}
										label={
											<Text
												ff="monospace"
												size="sm"
												truncate
												title={flight.flight_id}
											>
												{flight.flight_id}
											</Text>
										}
										description={`${flight.provider} · ${flight.context_mode} context · cursor ${formatCount(flight.flight_cursor)}`}
										rightSection={<Badge size="sm">{flight.status}</Badge>}
									/>
								))}
							</ScrollArea.Autosize>
							<FlightPager page={page} />
						</Stack>
					</Paper>
					<Box
						flex={1}
						miw={0}
					>
						{selected === null ? (
							<Text size="sm">There is no flight to show yet.</Text>
						) : detail.isError ? (
							<Alert
								color="red"
								title="This flight could not be read"
							>
								{describeRrdError(detail.error)}
							</Alert>
						) : detail.data ? (
							<FlightDetail flight={detail.data} />
						) : (
							<Group>
								<Loader size="sm" />
								<Text size="sm">Reading the flight…</Text>
							</Group>
						)}
					</Box>
				</Group>
			)}
		</Stack>
	);
}

function FlightDetail({ flight }: { flight: RrdPromptFlightDetailView }) {
	return (
		<Stack gap="md">
			<Group gap="xs">
				<Text
					ff="monospace"
					fw={700}
				>
					{flight.flight_id}
				</Text>
				<Badge>{flight.status}</Badge>
				<Badge variant="outline">{flight.provider}</Badge>
				<Badge variant="outline">{flight.context_mode} context</Badge>
			</Group>
			<Paper
				withBorder
				p="md"
			>
				<Text
					size="xs"
					tt="uppercase"
					c="dimmed"
				>
					The prompt
				</Text>
				<Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
					{flight.prompt}
				</Text>
			</Paper>
			<SimpleGrid cols={{ base: 2, lg: 3 }}>
				<Stat
					label="Recorded"
					value={formatTime(flight.created_at_unix_ms)}
				/>
				<Stat
					label="Time taken"
					value={`${formatCount(flight.elapsed_ms)} ms`}
				/>
				<Stat
					label="Context items gathered"
					value={formatCount(flight.context_items)}
				/>
				<Stat
					label="Context size"
					value={formatSize(flight.context_output_bytes)}
				/>
				<Stat
					label="Steps recorded"
					value={formatCount(flight.event_count)}
				/>
				<Stat
					label="Known at cursor"
					value={formatCount(flight.known_at_cursor)}
				/>
			</SimpleGrid>
			<Text
				size="sm"
				c="dimmed"
			>
				Cohort{" "}
				<Text
					span
					ff="monospace"
					title={flight.cohort_sha256}
				>
					{shortDigest(flight.cohort_sha256)}
				</Text>
				{flight.acceptance_marker !== null &&
					` · acceptance marker ${flight.acceptance_marker}`}
			</Text>
			<Paper
				withBorder
				p="md"
			>
				<FlightEventMap flight={flight} />
			</Paper>
		</Stack>
	);
}
