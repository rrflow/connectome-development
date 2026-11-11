import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useStable } from "~/hooks/state/stable";
import classes from "../style.module.scss";
import exploreGraph from "./explore-graph.v1.json";

/** What a step can wait for. `scripts/check-guides.mjs` holds guides to these. */
export type GuideSignal = "record-selected" | "depth-details" | "scope-around";

export type GuideRequirement = "session" | "records";

export interface GuideStep {
	/** The tab this step happens on, opened when the step begins. */
	route?: string;
	/** The `data-guide` name of the real control this step attaches to. */
	anchor: string;
	text: string;
	/** What to do. A step with no `until` is the guide's last, and ends with Finish. */
	action?: string;
	/** Ends this step. Only the real action emits it: a guide has no Next button. */
	until?: GuideSignal;
}

export interface Guide {
	id: string;
	version: number;
	title: string;
	summary: string;
	requires: GuideRequirement[];
	steps: GuideStep[];
}

export const GUIDES = [exploreGraph] as Guide[];

interface GuideHost {
	start: (guide: Guide) => void;
	signal: (name: GuideSignal) => void;
	/** What the current step is waiting for. */
	waiting: GuideSignal | null;
}

const GuideContext = createContext<GuideHost | null>(null);

/** Starts guides; `null` outside the workspace. */
export function useGuides() {
	return useContext(GuideContext);
}

/** Tells a running guide that the person really did something. */
export function useGuideSignal() {
	return useContext(GuideContext)?.signal;
}

/**
 * Ends a step on a state, not an event. The person can reach that state before the
 * step begins, and then no control could produce the event the step waits for.
 */
export function useGuideState(name: GuideSignal, holds: boolean) {
	const host = useContext(GuideContext);
	const waiting = host?.waiting === name;
	const signal = host?.signal;

	useEffect(() => {
		if (waiting && holds) signal?.(name);
	}, [waiting, holds, signal, name]);
}

export interface GuideProviderProps {
	route: string;
	onOpen: (route: string) => void;
	children: ReactNode;
}

/**
 * Runs one guide at a time over the real window (sprint 016, parking lot 006). It
 * never blocks the controls under it, and leaving a guide changes nothing.
 */
export function GuideProvider({ route, onOpen, children }: GuideProviderProps) {
	const [running, setRunning] = useState<{ guide: Guide; index: number } | null>(null);
	const step = running ? running.guide.steps[running.index] : null;

	const signal = useStable((name: GuideSignal) => {
		setRunning((current) => {
			if (!current || current.guide.steps[current.index].until !== name) return current;
			return { ...current, index: current.index + 1 };
		});
	});
	const waiting = step?.until ?? null;
	const host = useMemo(
		() => ({ start: (guide: Guide) => setRunning({ guide, index: 0 }), signal, waiting }),
		[waiting],
	);

	// A step opens its tab when it begins, and then the person is free to move.
	const openTab = useStable((target?: string) => {
		if (target && target !== route) onOpen(target);
	});
	const stepRoute = step?.route;
	useEffect(() => {
		openTab(stepRoute);
	}, [stepRoute]);

	return (
		<GuideContext.Provider value={host}>
			{children}
			{running &&
				step &&
				createPortal(
					<GuideOverlay
						guide={running.guide}
						index={running.index}
						step={step}
						route={route}
						onOpen={onOpen}
						onLeave={() => setRunning(null)}
					/>,
					document.body,
				)}
		</GuideContext.Provider>
	);
}

interface Box {
	top: number;
	left: number;
	width: number;
	height: number;
}

function sameBox(a: Box | null, b: Box | null) {
	return (
		a === b ||
		(a !== null &&
			b !== null &&
			a.top === b.top &&
			a.left === b.left &&
			a.width === b.width &&
			a.height === b.height)
	);
}

/** Follows a real control as panes scroll, panels open and the window resizes. */
function useAnchorBox(anchor: string) {
	const [box, setBox] = useState<Box | null>(null);

	useEffect(() => {
		let frame = 0;
		let found = false;
		const follow = () => {
			const element = document.querySelector(`[data-guide="${anchor}"]`);
			const rect = element?.getBoundingClientRect();
			// A closed panel keeps its contents, with no size.
			const shown = rect && rect.width > 0 && rect.height > 0;
			if (shown && !found) {
				found = true;
				element?.scrollIntoView({ block: "nearest" });
			}
			const next = shown
				? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
				: null;
			setBox((current) => (sameBox(current, next) ? current : next));
			frame = requestAnimationFrame(follow);
		};
		follow();
		return () => cancelAnimationFrame(frame);
	}, [anchor]);

	return box;
}

const GAP = 12;
const MARGIN = 8;

/** Where a callout goes so that it does not hide what it explains. */
function placeCallout(box: Box, width: number, height: number) {
	const view = { width: window.innerWidth, height: window.innerHeight };
	const clampLeft = (left: number) =>
		Math.max(MARGIN, Math.min(left, view.width - width - MARGIN));
	const clampTop = (top: number) =>
		Math.max(MARGIN, Math.min(top, view.height - height - MARGIN));

	// A control this large has no free side: above it, or else inside its corner.
	if (box.width > view.width / 2) {
		const above = box.top - GAP - height;
		return {
			top: above >= MARGIN ? above : clampTop(box.top + box.height - height - GAP),
			left: clampLeft(box.left + GAP),
		};
	}
	const needed = width + GAP + MARGIN;
	const leftRoom = box.left;
	const rightRoom = view.width - box.left - box.width;
	if (leftRoom >= needed && leftRoom >= rightRoom) {
		return { top: clampTop(box.top), left: box.left - GAP - width };
	}
	if (rightRoom >= needed) {
		return { top: clampTop(box.top), left: box.left + box.width + GAP };
	}
	if (box.top + box.height + GAP + height <= view.height) {
		return { top: box.top + box.height + GAP, left: clampLeft(box.left) };
	}
	return { top: clampTop(box.top - GAP - height), left: clampLeft(box.left) };
}

interface GuideOverlayProps {
	guide: Guide;
	index: number;
	step: GuideStep;
	route: string;
	onOpen: (route: string) => void;
	onLeave: () => void;
}

/** The tab a step happens on: its own, or the last one the guide opened. */
function stepTab(guide: Guide, index: number) {
	return guide.steps
		.slice(0, index + 1)
		.reverse()
		.find((step) => step.route)?.route;
}

function GuideOverlay({ guide, index, step, route, onOpen, onLeave }: GuideOverlayProps) {
	const box = useAnchorBox(step.anchor);
	const tab = stepTab(guide, index);
	const away = tab !== undefined && tab !== route;
	const callout = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ top: MARGIN, left: MARGIN });

	useLayoutEffect(() => {
		if (!box || !callout.current) return;
		const { offsetWidth, offsetHeight } = callout.current;
		const next = placeCallout(box, offsetWidth, offsetHeight);
		setPosition((current) =>
			current.top === next.top && current.left === next.left ? current : next,
		);
	}, [box]);

	return (
		<>
			{box && (
				<div
					data-guide-spot
					className={classes.guideSpot}
					style={{
						top: box.top - 4,
						left: box.left - 4,
						width: box.width + 8,
						height: box.height + 8,
					}}
				/>
			)}
			<Paper
				ref={callout}
				className={classes.guideCallout}
				style={position}
				p="md"
				role="status"
				aria-label={guide.title}
			>
				<Stack gap="xs">
					<Group
						justify="space-between"
						wrap="nowrap"
					>
						<Text
							fz="xs"
							ff="monospace"
							c="violet"
						>
							Step {index + 1} of {guide.steps.length}
						</Text>
						<div className={classes.guideProgress}>
							{guide.steps.map((_, position) => (
								<span
									key={position}
									data-done={position <= index || undefined}
								/>
							))}
						</div>
					</Group>
					<Text fz="sm">{step.text}</Text>
					{!box && (
						<Text
							fz="sm"
							c="slate"
						>
							{away
								? "This step is on another tab."
								: "This step's control is hidden. If you closed the details panel, press Show details."}
						</Text>
					)}
					{step.action && (
						<Text
							fz="sm"
							fw={600}
							c="bright"
						>
							{step.action}
						</Text>
					)}
					<Group justify="space-between">
						<Button
							size="compact-xs"
							variant="subtle"
							color="obsidian"
							onClick={onLeave}
						>
							Leave guide
						</Button>
						{!box && away && (
							<Button
								size="xs"
								variant="light"
								onClick={() => onOpen(tab)}
							>
								Back to this step
							</Button>
						)}
						{!step.until && (
							<Button
								size="xs"
								variant="gradient"
								onClick={onLeave}
							>
								Finish
							</Button>
						)}
					</Group>
				</Stack>
			</Paper>
		</>
	);
}
