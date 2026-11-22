import { Box, Group, Stack, Text } from "@mantine/core";
import { type GlossaryTerm, Term } from "../components/glossary";
import classes from "./engine.module.scss";
import type { PartId, PartPosition } from "./model";

export const PARTS: { id: PartId; term: GlossaryTerm; name: string; role: string }[] = [
	{ id: "db", term: "engram", name: "rrflowDB", role: "commits each change" },
	{ id: "kv", term: "rrflowKV", name: "rrflowKV · LSM", role: "stores every change" },
	{ id: "ql", term: "rrflowQL", name: "rrflowQL", role: "answers at a change" },
	{ id: "cld", term: "rrflowCLD", name: "rrflowCLD", role: "copies changes cold" },
];

/** Where each part's position falls on the rail, 0 to 100. */
function percent(cursor: number, start: number, head: number): number {
	if (head <= start) return 100;
	return Math.max(0, Math.min(100, ((cursor - start) / (head - start)) * 100));
}

function reading(position: PartPosition): string {
	switch (position.kind) {
		case "at":
			return `change ${position.cursor.toLocaleString()}`;
		case "behind":
			return `change ${position.cursor.toLocaleString()} · reading ${position.by.toLocaleString()} earlier`;
		default:
			return position.reason;
	}
}

export interface CursorRailProps {
	parts: Record<PartId, PartPosition>;
	head: number;
	/** True for one render after the head moved, so its marker pulses. */
	advanced: boolean;
}

/**
 * Comparable observations on the change cursor; physical sequences stay separate. The rail starts a little
 * before the furthest-behind part so a small lag stays visible; its first
 * change is printed, so the scale is never implied.
 */
export function CursorRail({ parts, head, advanced }: CursorRailProps) {
	const placed = Object.values(parts).flatMap((position) =>
		position.kind === "at" || position.kind === "behind" ? [position.cursor] : [],
	);
	const lowest = Math.min(head, ...placed);
	const start = Math.max(0, lowest - Math.max(1, Math.ceil((head - lowest) * 0.1)));
	return (
		<Stack gap="md">
			{PARTS.map((part) => {
				const position = parts[part.id];
				const placedHere = position.kind === "at" || position.kind === "behind";
				const at = placedHere ? percent(position.cursor, start, head) : 0;
				return (
					<Group
						key={part.id}
						wrap="nowrap"
						gap="md"
						data-part={part.id}
						data-state={position.kind}
					>
						<Box
							w={150}
							style={{ flexShrink: 0 }}
						>
							<Text
								fw={700}
								c="bright"
							>
								<Term id={part.term}>{part.name}</Term>
							</Text>
							<Text
								fz="xs"
								c="slate"
							>
								{part.role}
							</Text>
						</Box>
						<Box
							flex={1}
							miw={80}
						>
							{placedHere ? (
								<Box className={classes.track}>
									<Box
										className={classes.fill}
										data-state={position.kind}
										style={{ width: `${at}%` }}
									/>
									<Box
										className={classes.marker}
										data-state={position.kind}
										data-pulse={part.id === "db" && advanced ? "true" : "false"}
										style={{ left: `${at}%` }}
									/>
								</Box>
							) : (
								<Box className={classes.missing} />
							)}
						</Box>
						<Text
							w={230}
							ta="right"
							fz="sm"
							ff={placedHere ? "monospace" : undefined}
							c={
								position.kind === "behind"
									? "rrflow.4"
									: placedHere
										? "bright"
										: "slate"
							}
							style={{ flexShrink: 0 }}
						>
							{reading(position)}
						</Text>
					</Group>
				);
			})}
			<Group
				justify="space-between"
				ml={166}
				mr={246}
			>
				<Text
					fz="xs"
					c="slate"
					ff="monospace"
				>
					change {start.toLocaleString()}
				</Text>
				<Text
					fz="xs"
					c="slate"
					ff="monospace"
				>
					change {head.toLocaleString()} · latest observed
				</Text>
			</Group>
		</Stack>
	);
}
