import { Box, Code, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "~/components/ActionButton";
import { Icon } from "~/components/Icon";
import { iconClose } from "~/icons";
import { useGuideState } from "../guides/engine";

interface InspectorHost {
	target: HTMLElement | null;
	/** Tells the window a view has something to inspect; returns how to withdraw it. */
	present: () => () => void;
	close: () => void;
}

export const InspectorContext = createContext<InspectorHost | null>(null);

/**
 * Puts a view's details in the window's inspector column (sprint 016). The view
 * keeps its own state; only where the details appear changes.
 */
export function InspectorPanel({ children }: { children: ReactNode }) {
	const host = useContext(InspectorContext);
	const present = host?.present;

	useEffect(() => present?.(), [present]);

	if (!host?.target) return null;

	return createPortal(
		<Stack
			gap="sm"
			pos="relative"
		>
			<Box
				pos="absolute"
				top={0}
				right={0}
				style={{ zIndex: 1 }}
			>
				<ActionButton
					label="Close details"
					onClick={host.close}
				>
					<Icon path={iconClose} />
				</ActionButton>
			</Box>
			{children}
		</Stack>,
		host.target,
	);
}

type Depth = "plain" | "details" | "raw";

const DEPTHS: { label: string; value: Depth }[] = [
	{ label: "Plain words", value: "plain" },
	{ label: "Details", value: "details" },
	{ label: "Raw", value: "raw" },
];

export interface InspectorObjectProps {
	kind: ReactNode;
	title: string;
	identity?: string;
	actions?: ReactNode;
	plain: ReactNode;
	details: ReactNode;
	raw: unknown;
	/** Where to go next. Stays in view at every depth, so nothing is a dead end. */
	links?: ReactNode;
}

/** One object at three depths: plain words, details, raw evidence. */
export function InspectorObject({
	kind,
	title,
	identity,
	actions,
	plain,
	details,
	raw,
	links,
}: InspectorObjectProps) {
	const [depth, setDepth] = useState<Depth>("plain");
	useGuideState("depth-details", depth === "details");

	return (
		<>
			<Box pr={32}>
				<Group
					gap={6}
					mb={4}
				>
					{kind}
				</Group>
				<Text
					fw={700}
					fz="lg"
					c="bright"
					lineClamp={3}
				>
					{title}
				</Text>
				{identity && (
					<Text
						ff="monospace"
						fz="xs"
						c="slate"
						style={{ wordBreak: "break-all" }}
					>
						{identity}
					</Text>
				)}
			</Box>
			{actions && <Group gap="xs">{actions}</Group>}
			<Box data-guide="inspector-depth">
				<SegmentedControl
					size="xs"
					fullWidth
					aria-label="Depth"
					value={depth}
					onChange={(next) => setDepth(next as Depth)}
					data={DEPTHS}
				/>
			</Box>
			{depth === "plain" && <Text fz="sm">{plain}</Text>}
			{depth === "details" && details}
			{depth === "raw" && (
				<Code
					block
					style={{ overflowX: "auto" }}
				>
					{JSON.stringify(raw, null, 2)}
				</Code>
			)}
			{links && <Box data-guide="inspector-links">{links}</Box>}
		</>
	);
}
