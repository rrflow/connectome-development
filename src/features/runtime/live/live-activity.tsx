import { Anchor, Button, Group, Popover, Stack, Text } from "@mantine/core";
import { Icon } from "~/components/Icon";
import { iconLive } from "~/shared/assets/icons";
import { formatCount, formatTime } from "../utils/format";
import type { LiveBatch, LiveChanges } from "./use-live-changes";

/** Targets listed under one step; the rest are counted. */
const MAX_LISTED_TARGETS = 6;

function changeCount(batch: LiveBatch) {
	const count = batch.targets.length;
	return `${formatCount(count)} ${count === 1 ? "change" : "changes"}`;
}

function summary({ status, batches }: LiveChanges) {
	if (status.state === "connecting") return "Connecting to live changes";
	if (status.state === "stopped") return "Not live";
	return batches[0] ? `Live · ${changeCount(batches[0])}` : "Live";
}

/** What the live stream is doing, and the steps it has applied to the graph. */
export function LiveActivity({
	live,
	isDrawn,
	onSelect,
}: {
	live: LiveChanges;
	isDrawn: (id: string) => boolean;
	onSelect: (id: string) => void;
}) {
	const { status, batches } = live;
	return (
		<Popover
			width={340}
			position="bottom-end"
			shadow="md"
		>
			<Popover.Target>
				<Button
					variant="subtle"
					size="compact-xs"
					color={status.state === "stopped" ? "red" : undefined}
					leftSection={<Icon path={iconLive} />}
				>
					{summary(live)}
				</Button>
			</Popover.Target>
			<Popover.Dropdown>
				<Stack gap="sm">
					{status.state === "stopped" && <Text fz="sm">{status.reason}</Text>}
					{status.state !== "stopped" && batches.length === 0 && (
						<Text
							fz="sm"
							c="slate"
						>
							Waiting for the engine to record a change. Changes appear on the graph
							without moving what is already there.
						</Text>
					)}
					{batches.map((batch) => (
						<Stack
							key={batch.throughCursor}
							gap={2}
						>
							<Group justify="space-between">
								<Text
									fz="sm"
									fw={600}
								>
									{changeCount(batch)}
								</Text>
								<Text
									fz="xs"
									c="slate"
								>
									{formatTime(batch.atUnixMs)}
								</Text>
							</Group>
							{batch.targets.slice(0, MAX_LISTED_TARGETS).map((target) =>
								isDrawn(target) ? (
									<Anchor
										key={target}
										component="button"
										fz="xs"
										ta="left"
										onClick={() => onSelect(target)}
									>
										{target}
									</Anchor>
								) : (
									<Text
										key={target}
										fz="xs"
										c="slate"
									>
										{target}
									</Text>
								),
							)}
							{batch.targets.length > MAX_LISTED_TARGETS && (
								<Text
									fz="xs"
									c="slate"
								>
									and {formatCount(batch.targets.length - MAX_LISTED_TARGETS)}{" "}
									more
								</Text>
							)}
						</Stack>
					))}
				</Stack>
			</Popover.Dropdown>
		</Popover>
	);
}
