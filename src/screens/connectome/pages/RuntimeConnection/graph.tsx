import {
	Box,
	type BoxProps,
	Collapse,
	Group,
	Paper,
	ScrollArea,
	Stack,
	Text,
	UnstyledButton,
	useMantineTheme,
} from "@mantine/core";
import {
	Icon,
	iconChevronDown,
	iconChevronUp,
	iconFullscreen,
	iconMagnifyMinus,
	iconMagnifyPlus,
	iconMaximize,
	iconMinimize,
} from "@rrflow/ui";
import Graph from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2, { inferSettings } from "graphology-layout-forceatlas2";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Sigma from "sigma";
import type { EdgeDisplayData, NodeDisplayData } from "sigma/types";
import { ActionButton } from "~/components/ActionButton";
import { useStable } from "~/hooks/stable";
import { getIsLight, useIsLight } from "~/hooks/theme";
import type { ColorGroup } from "./groups";
import { createLabelLayer, type ScreenBox } from "./labels";

/** Iterations of ForceAtlas2 applied before the first frame; the graph is static afterwards. */
const LAYOUT_ITERATIONS = 300;
/** Barnes-Hut approximation pays off once the graph is this large. */
const BARNES_HUT_THRESHOLD = 500;
/**
 * LinLog attraction with strong gravity keeps clusters visibly apart and
 * unlinked records near the middle. On RRFlow's own 271-document estate it
 * removed every overlapping node (300 before) and doubled the median gap.
 */
const LAYOUT_SETTINGS = { linLogMode: true, strongGravityMode: true, gravity: 1 } as const;
/** Longest label drawn on the canvas; the hover card shows the full text. */
const MAX_CANVAS_LABEL = 40;
/** More lit nodes than this keep sigma's own label thinning instead of forced labels. */
const MAX_FORCED_LABELS = 30;
/** Camera ratio when the focus is a single node; 1 shows the whole graph. */
const SINGLE_FOCUS_RATIO = 0.5;
/** Room around focused nodes, and the closest the camera zooms to a group. */
const FOCUS_PADDING = 1.4;
const MIN_FOCUS_RATIO = 0.2;
/** Legend rows are fixed width so long group names truncate instead of pushing counts out. */
const LEGEND_ROW_WIDTH = 264;
/** Ranks highlighted records' labels above every other label when they compete for space. */
const HIGHLIGHT_LABEL_PRIORITY = 1000;
const HOVER_OFFSET = 14;
const HOVER_WIDTH = 300;
/** Room kept below a hover card so it stays inside the canvas. */
const HOVER_HEIGHT = 150;

export interface CanvasNode {
	id: string;
	label: string;
}

export interface CanvasEdge {
	id: string;
	from: string;
	to: string;
	/** Layout pull between the two nodes; 1 when omitted. */
	weight?: number;
}

interface NodeAttributes {
	label: string;
	x: number;
	y: number;
	size: number;
	color: string;
}

interface EdgeAttributes {
	weight: number;
	size: number;
}

const EMPTY: ReadonlySet<string> = new Set();

interface Focus {
	hovered: string;
	selected: string | null;
	highlighted: ReadonlySet<string>;
	dimUnselected: boolean;
	activeGroup: string | null;
	groupOf: ReadonlyMap<string, string>;
	colors: ReadonlyMap<string, string>;
	/** Nodes the focus keeps lit; `null` lights every node. */
	lit: ReadonlySet<string> | null;
}

/** Hovering lights a neighbourhood; otherwise highlights, then the selection. */
function litNodes(layout: Graph<NodeAttributes, EdgeAttributes>, focus: Focus) {
	if (focus.hovered && layout.hasNode(focus.hovered)) {
		return new Set([focus.hovered, ...layout.neighbors(focus.hovered)]);
	}
	if (focus.highlighted.size > 0) {
		return new Set([...focus.highlighted, ...(focus.selected ? [focus.selected] : [])]);
	}
	if (focus.dimUnselected && focus.selected && layout.hasNode(focus.selected)) {
		return new Set([focus.selected, ...layout.neighbors(focus.selected)]);
	}
	return null;
}

export interface GraphCanvasProps extends BoxProps {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	directed: boolean;
	/** Node id to color group id. */
	groupOf: ReadonlyMap<string, string>;
	groups: ColorGroup[];
	/** Legend heading, such as "Color: Cluster". */
	legendTitle: string;
	selected: string | null;
	/** Nodes to keep lit and labelled around the selection. */
	highlighted?: ReadonlySet<string>;
	/**
	 * Dim nodes outside the selection's direct neighbourhood. A neighbourhood
	 * subgraph is already the context, so it keeps every drawn node lit.
	 */
	dimUnselected: boolean;
	onSelect: (id: string | null) => void;
	/** Content of the card shown while the pointer rests on a node. */
	renderHover: (id: string) => ReactNode;
	/** One line telling a first-time reader how to use the canvas. */
	hint: string;
}

/** The area an overlay covers, in the coordinates of the canvas it sits on. */
function coverage(element: HTMLElement | null): ScreenBox[] {
	return element
		? [
				{
					left: element.offsetLeft,
					top: element.offsetTop,
					right: element.offsetLeft + element.offsetWidth,
					bottom: element.offsetTop + element.offsetHeight,
				},
			]
		: [];
}

/** Frames the focused nodes: one node closely, a group with room around it. */
function bringIntoView(instance: Sigma<NodeAttributes, EdgeAttributes>, nodes: Iterable<string>) {
	const points = [...nodes].flatMap((node) => {
		const display = instance.getNodeDisplayData(node);
		return display ? [display] : [];
	});
	if (points.length === 0) return;
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	const [minX, maxX, minY, maxY] = [
		Math.min(...xs),
		Math.max(...xs),
		Math.min(...ys),
		Math.max(...ys),
	];
	const extent = Math.max(maxX - minX, maxY - minY) * FOCUS_PADDING;
	const ratio =
		points.length === 1 ? SINGLE_FOCUS_RATIO : Math.min(1, Math.max(MIN_FOCUS_RATIO, extent));
	instance
		.getCamera()
		.animate({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, ratio }, { duration: 400 });
}

function canvasLabel(label: string): string {
	return label.length > MAX_CANVAS_LABEL ? `${label.slice(0, MAX_CANVAS_LABEL - 1)}…` : label;
}

/**
 * A ForceAtlas2 layout of nodes and edges drawn with sigma. Node size follows
 * degree; color follows the caller's grouping. Hovering a node lights its
 * neighbourhood and shows a card; clicking selects it.
 */
export function GraphCanvas({
	nodes,
	edges,
	directed,
	groupOf,
	groups,
	legendTitle,
	selected,
	highlighted,
	dimUnselected,
	onSelect,
	renderHover,
	hint,
	...other
}: GraphCanvasProps) {
	const ref = useRef<HTMLDivElement>(null);
	const sigmaRef = useRef<Sigma<NodeAttributes, EdgeAttributes> | null>(null);
	// Overlays labels must stay clear of; they share the canvas's origin.
	const hintRef = useRef<HTMLDivElement>(null);
	const controlsRef = useRef<HTMLDivElement>(null);
	const legendRef = useRef<HTMLDivElement>(null);
	const theme = useMantineTheme();
	const isLight = useIsLight();
	const handleSelect = useStable(onSelect);
	const [hover, setHover] = useState<{ id: string; left: number; top: number } | null>(null);
	const [activeGroup, setActiveGroup] = useState<string | null>(null);
	const [expanded, setExpanded] = useState(false);
	const [legendOpen, setLegendOpen] = useState(true);

	const colors = useMemo(
		() =>
			new Map(
				groups.map((group) => [
					group.id,
					(group.palette && theme.colors[group.palette]?.[6]) || theme.colors.obsidian[4],
				]),
			),
		[groups, theme.colors],
	);

	const focusRef = useRef<Focus>({
		hovered: "",
		selected,
		highlighted: highlighted ?? EMPTY,
		dimUnselected,
		activeGroup,
		groupOf,
		colors,
		lit: null,
	});

	const layout = useMemo(() => {
		const model = new Graph<NodeAttributes, EdgeAttributes>({
			multi: true,
			type: directed ? "directed" : "undirected",
			allowSelfLoops: true,
		});
		for (const node of nodes) {
			model.addNode(node.id, {
				label: canvasLabel(node.label),
				x: 0,
				y: 0,
				size: 3,
				color: "",
			});
		}
		for (const edge of edges) {
			if (model.hasNode(edge.from) && model.hasNode(edge.to)) {
				model.addEdgeWithKey(edge.id, edge.from, edge.to, {
					weight: edge.weight ?? 1,
					size: 1,
				});
			}
		}
		model.forEachNode((node) => {
			model.setNodeAttribute(node, "size", 3 + 2 * Math.log2(1 + model.degree(node)));
		});
		if (model.order > 0) {
			circular.assign(model);
			forceAtlas2.assign(model, {
				iterations: LAYOUT_ITERATIONS,
				settings: {
					...inferSettings(model),
					...LAYOUT_SETTINGS,
					barnesHutOptimize: model.order > BARNES_HUT_THRESHOLD,
					edgeWeightInfluence: 1,
				},
			});
		}
		return model;
	}, [nodes, edges, directed]);

	const legend = useMemo(() => {
		const drawn = new Map<string, number>();
		for (const node of nodes) {
			const group = groupOf.get(node.id);
			if (group) drawn.set(group, (drawn.get(group) ?? 0) + 1);
		}
		return groups
			.filter((group) => drawn.has(group.id))
			.map((group) => ({ ...group, drawn: drawn.get(group.id) ?? 0 }));
	}, [nodes, groupOf, groups]);

	const edgeColor = isLight ? theme.colors.obsidian[2] : theme.colors.obsidian[6];
	const labelColor = isLight ? theme.colors.obsidian[9] : theme.colors.obsidian[0];

	// Selection, highlights, grouping, and legend focus repaint without relayout;
	// a new selection is brought into view.
	useEffect(() => {
		const focus = focusRef.current;
		const nextHighlights = highlighted ?? EMPTY;
		const moved =
			focus.selected !== selected ||
			(selected !== null && focus.highlighted !== nextHighlights);
		focus.selected = selected;
		focus.highlighted = nextHighlights;
		focus.dimUnselected = dimUnselected;
		focus.activeGroup = activeGroup;
		focus.groupOf = groupOf;
		focus.colors = colors;
		focus.lit = litNodes(layout, focus);
		const instance = sigmaRef.current;
		if (!instance) return;
		instance.refresh({ skipIndexation: true });
		if (moved && selected) bringIntoView(instance, focus.lit ?? [selected]);
	}, [layout, selected, highlighted, dimUnselected, activeGroup, groupOf, colors]);

	useEffect(() => {
		if (!ref.current) return;
		const dimmed = () => (getIsLight() ? theme.colors.obsidian[1] : theme.colors.obsidian[7]);
		focusRef.current.lit = litNodes(layout, focusRef.current);
		// Highlighted records first, then the most linked; node size follows degree.
		const labels = createLabelLayer(
			(node) =>
				(focusRef.current.highlighted.has(node) ? HIGHLIGHT_LABEL_PRIORITY : 0) +
				(layout.hasNode(node) ? layout.getNodeAttribute(node, "size") : 0),
			() => [hintRef, controlsRef, legendRef].flatMap((overlay) => coverage(overlay.current)),
		);

		const instance = new Sigma<NodeAttributes, EdgeAttributes>(layout, ref.current, {
			allowInvalidContainer: true,
			defaultEdgeType: directed ? "arrow" : "line",
			defaultEdgeColor: edgeColor,
			labelColor: { color: labelColor },
			labelFont: theme.fontFamily ?? "sans-serif",
			labelSize: 12,
			labelWeight: "500",
			labelDensity: 0.4,
			labelGridCellSize: 160,
			labelRenderedSizeThreshold: 9,
			stagePadding: 32,
			zIndex: true,
			defaultDrawNodeHover: labels.drawHover,
			defaultDrawNodeLabel: labels.drawLabel,
			nodeReducer: (node, data) => {
				const focus = focusRef.current;
				const display: Partial<NodeDisplayData> = { ...data };
				const group = focus.groupOf.get(node);
				display.color = (group && focus.colors.get(group)) || theme.colors.obsidian[4];
				const inGroup = !focus.activeGroup || group === focus.activeGroup;
				const lit = focus.lit;
				const isLit = (!lit || lit.has(node)) && (inGroup || node === focus.selected);
				if (!isLit) {
					display.label = "";
					display.color = dimmed();
					display.zIndex = 0;
					return display;
				}
				display.zIndex = 1;
				// graphology's `order` counts nodes (`size` counts edges).
				if ((lit ? lit.size : layout.order) <= MAX_FORCED_LABELS) {
					display.forceLabel = true;
				}
				if (node === focus.selected || node === focus.hovered) {
					display.highlighted = true;
					display.forceLabel = true;
					display.zIndex = 2;
				}
				return display;
			},
			edgeReducer: (edge, data) => {
				const display: Partial<EdgeDisplayData> = { ...data };
				const focus = focusRef.current;
				const [from, to] = layout.extremities(edge);
				const ends = [from, to].map((node) => focus.groupOf.get(node));
				const inGroup =
					!focus.activeGroup || ends.every((group) => group === focus.activeGroup);
				if (!inGroup) {
					display.hidden = true;
				} else if (focus.hovered) {
					display.hidden = from !== focus.hovered && to !== focus.hovered;
				} else if (focus.lit) {
					display.hidden = !(focus.lit.has(from) && focus.lit.has(to));
				}
				return display;
			},
		});
		instance.on("beforeRender", labels.beginFrame);
		instance.on("afterRender", labels.endFrame);
		const repaint = () => {
			focusRef.current.lit = litNodes(layout, focusRef.current);
			instance.refresh({ skipIndexation: true });
		};

		instance.on("enterNode", ({ node }) => {
			focusRef.current.hovered = node;
			repaint();
			const display = instance.getNodeDisplayData(node);
			if (display) {
				const position = instance.framedGraphToViewport(display);
				const width = ref.current?.offsetWidth ?? HOVER_WIDTH;
				const height = ref.current?.offsetHeight ?? HOVER_HEIGHT;
				setHover({
					id: node,
					left: Math.max(8, Math.min(position.x + HOVER_OFFSET, width - HOVER_WIDTH - 8)),
					top: Math.max(8, Math.min(position.y + HOVER_OFFSET, height - HOVER_HEIGHT)),
				});
			}
		});
		instance.on("leaveNode", () => {
			focusRef.current.hovered = "";
			repaint();
			setHover(null);
		});
		instance.on("clickNode", ({ node }) => handleSelect(node));
		instance.on("clickStage", () => handleSelect(null));
		instance.getCamera().on("updated", () => setHover(null));

		sigmaRef.current = instance;
		// A neighbourhood subgraph is already framed by the initial camera.
		const { selected: selection, dimUnselected: dimming, lit } = focusRef.current;
		if (selection && dimming) bringIntoView(instance, lit ?? [selection]);
		return () => {
			instance.kill();
			sigmaRef.current = null;
		};
	}, [layout, directed, edgeColor, labelColor, theme.colors.obsidian, theme.fontFamily]);

	// The canvas fills the window while expanded; Escape restores it.
	useEffect(() => {
		sigmaRef.current?.refresh();
		if (!expanded) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setExpanded(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [expanded]);

	return (
		<Box
			pos={expanded ? "fixed" : "relative"}
			{...other}
			{...(expanded && {
				inset: 16,
				h: "auto",
				style: {
					zIndex: 250,
					background: "var(--mantine-color-body)",
					borderRadius: "var(--mantine-radius-md)",
					boxShadow: "var(--mantine-shadow-xl)",
				},
			})}
		>
			<Box
				ref={ref}
				h="100%"
			/>

			<Paper
				ref={hintRef}
				pos="absolute"
				top={8}
				left={8}
				px="sm"
				py={4}
				bg={isLight ? "obsidian.0" : "obsidian.8"}
				style={{ pointerEvents: "none" }}
			>
				<Text
					fz="xs"
					c="slate"
				>
					{hint}
				</Text>
			</Paper>

			<Group
				ref={controlsRef}
				gap={4}
				pos="absolute"
				top={8}
				right={8}
			>
				<ActionButton
					label="Zoom in"
					variant="subtle"
					onClick={() => sigmaRef.current?.getCamera().animatedZoom()}
				>
					<Icon path={iconMagnifyPlus} />
				</ActionButton>
				<ActionButton
					label="Zoom out"
					variant="subtle"
					onClick={() => sigmaRef.current?.getCamera().animatedUnzoom()}
				>
					<Icon path={iconMagnifyMinus} />
				</ActionButton>
				<ActionButton
					label="Fit to view"
					variant="subtle"
					onClick={() => sigmaRef.current?.getCamera().animatedReset()}
				>
					<Icon path={iconFullscreen} />
				</ActionButton>
				<ActionButton
					label={expanded ? "Shrink (Esc)" : "Expand"}
					variant="subtle"
					onClick={() => setExpanded((value) => !value)}
				>
					<Icon path={expanded ? iconMinimize : iconMaximize} />
				</ActionButton>
			</Group>

			{legend.length > 0 && (
				<Paper
					ref={legendRef}
					pos="absolute"
					bottom={8}
					left={8}
					p={6}
					w={290}
					bg={isLight ? "obsidian.0" : "obsidian.8"}
				>
					<UnstyledButton
						px={4}
						mb={legendOpen ? 2 : 0}
						onClick={() => setLegendOpen((open) => !open)}
						title={legendOpen ? "Hide the legend" : "Show the legend"}
					>
						<Group
							gap={6}
							wrap="nowrap"
						>
							<Text
								fz="xs"
								fw={600}
							>
								{legendTitle}
							</Text>
							<Icon
								path={legendOpen ? iconChevronDown : iconChevronUp}
								size="sm"
							/>
						</Group>
					</UnstyledButton>
					<Collapse in={legendOpen}>
						<ScrollArea.Autosize
							mah={200}
							scrollbars="y"
							type="auto"
							offsetScrollbars="y"
						>
							<Stack
								gap={0}
								w={LEGEND_ROW_WIDTH}
							>
								{legend.map((group) => {
									const active = activeGroup === group.id;
									return (
										<UnstyledButton
											key={group.id}
											display="block"
											w="100%"
											px={4}
											py={2}
											title={
												active
													? "Show every group"
													: `Show only ${group.label}`
											}
											onClick={() => setActiveGroup(active ? null : group.id)}
											style={{
												borderRadius: "var(--mantine-radius-sm)",
												opacity: activeGroup && !active ? 0.5 : 1,
											}}
										>
											<Group
												gap={6}
												wrap="nowrap"
											>
												<Box
													w={9}
													h={9}
													bg={colors.get(group.id)}
													style={{ borderRadius: "50%", flexShrink: 0 }}
												/>
												<Text
													fz="xs"
													truncate
													flex={1}
													miw={0}
													fw={active ? 700 : undefined}
												>
													{group.label}
												</Text>
												<Text
													fz="xs"
													c="slate"
													ml="auto"
													style={{ flexShrink: 0 }}
												>
													{group.drawn}
												</Text>
											</Group>
										</UnstyledButton>
									);
								})}
							</Stack>
						</ScrollArea.Autosize>
					</Collapse>
				</Paper>
			)}

			{hover && (
				<Paper
					pos="absolute"
					left={hover.left}
					top={hover.top}
					w={HOVER_WIDTH}
					p="sm"
					shadow="md"
					withBorder
					style={{ pointerEvents: "none", zIndex: 5 }}
				>
					{renderHover(hover.id)}
				</Paper>
			)}
		</Box>
	);
}
