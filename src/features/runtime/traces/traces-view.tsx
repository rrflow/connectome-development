import {
	Alert,
	Badge,
	Box,
	Group,
	Loader,
	Paper,
	Select,
	Stack,
	Text,
	Timeline,
} from "@mantine/core";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import type { RrdPromptFlightDetailView } from "~/rrflow/session";
import { FlightPager } from "../flights/flights-view";
import { useFlightDetail, useFlightPage, useFlightSelection } from "../flights/use-flights";
import { useProject } from "../project/context";
import { formatCount, formatSize, formatTime } from "../utils/format";

/** For one prompt, the steps the engine recorded, in the order it took them. */
export function TracesView() {
	const { session } = useProject();
	const page = useFlightPage();
	const { snapshot } = page;
	const flights = [...(snapshot.data?.flights ?? [])].reverse();
	const [selected, select] = useFlightSelection(flights[0]?.flight_id ?? null);
	const detail = useFlightDetail(selected);
	if (!session) return null;

	return (
		<Stack gap="lg">
			<Box>
				<PrimaryTitle>Causal traces</PrimaryTitle>
				<Text mt="xs">
					This shows the recorded stages of each prompt flight: for one prompt, every step
					the engine wrote down, in order, with when it happened and what the engine noted
					about it. Pick a prompt to follow its chain from first step to last.
				</Text>
			</Box>
			{snapshot.isPending && (
				<Group>
					<Loader size="sm" />
					<Text size="sm">Reading the recorded prompts…</Text>
				</Group>
			)}
			{snapshot.isError && (
				<Alert
					color="red"
					title="The recorded prompts could not be read"
				>
					{describeRrdError(snapshot.error)}
				</Alert>
			)}
			{snapshot.data && flights.length === 0 && (
				<Text size="sm">
					The engine returned zero prompt flights
					{page.afterCursor === 0 ? "" : " on this page"}, so there is no chain to show.
				</Text>
			)}
			{snapshot.data && (
				<Stack gap="sm">
					{flights.length > 0 && (
						<Select
							label="Prompt flight, newest first"
							maw={520}
							value={selected}
							data={flights.map((flight) => ({
								value: flight.flight_id,
								label: `${flight.flight_id} · ${flight.status} · ${flight.provider}`,
							}))}
							allowDeselect={false}
							searchable
							onChange={(value) => {
								if (value) select(value);
							}}
						/>
					)}
					<FlightPager page={page} />
				</Stack>
			)}
			{selected !== null && detail.isError && (
				<Alert
					color="red"
					title="This prompt's steps could not be read"
				>
					{describeRrdError(detail.error)}
				</Alert>
			)}
			{selected !== null && !detail.data && !detail.isError && (
				<Group>
					<Loader size="sm" />
					<Text size="sm">Reading the recorded steps…</Text>
				</Group>
			)}
			{detail.data && <Chain flight={detail.data} />}
		</Stack>
	);
}

function Chain({ flight }: { flight: RrdPromptFlightDetailView }) {
	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack gap="md">
				<Group gap="xs">
					<Badge>{flight.status}</Badge>
					<Badge variant="outline">{flight.provider}</Badge>
					<Badge variant="outline">{flight.context_mode} context</Badge>
					<Text
						size="sm"
						c="dimmed"
					>
						Recorded {formatTime(flight.created_at_unix_ms)} · took{" "}
						{formatCount(flight.elapsed_ms)} ms in all
					</Text>
				</Group>
				<Box>
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
				</Box>
				<Text size="sm">
					The engine gathered {formatCount(flight.context_items)} context{" "}
					{flight.context_items === 1 ? "item" : "items"} (
					{formatSize(flight.context_output_bytes)}) for this prompt and recorded{" "}
					{formatCount(flight.event_count)} {flight.event_count === 1 ? "step" : "steps"};{" "}
					{formatCount(flight.events.length)} came back in this read.
				</Text>
				{flight.events.length === 0 ? (
					<Text size="sm">The engine returned zero steps for this prompt.</Text>
				) : (
					<Timeline
						active={flight.events.length - 1}
						bulletSize={26}
						lineWidth={2}
					>
						{flight.events.map((event) => (
							<Timeline.Item
								key={event.ordinal}
								bullet={<Text size="xs">{event.ordinal}</Text>}
								title={
									<Group gap="xs">
										<Badge
											variant="light"
											radius="sm"
										>
											{event.stage}
										</Badge>
										<Text fw={600}>{event.label}</Text>
									</Group>
								}
							>
								<Text
									size="sm"
									style={{ overflowWrap: "anywhere" }}
								>
									{event.detail}
								</Text>
								<Text
									size="xs"
									c="dimmed"
								>
									{formatTime(event.at_unix_ms)} · {formatCount(event.elapsed_ms)}{" "}
									ms elapsed
								</Text>
							</Timeline.Item>
						))}
					</Timeline>
				)}
			</Stack>
		</Paper>
	);
}
