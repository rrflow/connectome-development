import { Box, type BoxProps, Group, Paper, Stack, Text, useMantineTheme } from "@mantine/core";
import { Icon, iconFullscreen, iconMagnifyMinus, iconMagnifyPlus } from "@rrflow/ui";
import { MultiDirectedGraph } from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2, { inferSettings } from "graphology-layout-forceatlas2";
import { useEffect, useMemo, useRef } from "react";
import Sigma from "sigma";
import type { EdgeDisplayData, NodeDisplayData } from "sigma/types";
import { ActionButton } from "~/components/ActionButton";
import { drawHover, drawLabel } from "~/components/RelationGraph/drawing";
import { useStable } from "~/hooks/stable";
import { getIsLight, useIsLight } from "~/hooks/theme";
import type { RrdGraphView } from "~/rrflow/session";

/** Iterations of ForceAtlas2 applied before the first frame; the graph is static afterwards. */
const LAYOUT_ITERATIONS = 300;
/** Barnes-Hut approximation pays off once the record set is this large. */
const BARNES_HUT_THRESHOLD = 500;
const KIND_COLORS = [
	"violet",
	"blue",
	"teal",
	"orange",
	"pink",
	"cyan",
	"yellow",
	"grape",
	"green",
	"red",
	"indigo",
];

interface RecordNode {
	label: string;
	kind: string;
	x: number;
	y: number;
	size: number;
	color: string;
}

interface RelationEdge {
	kind: string;
	size: number;
}

export interface RecordGraphProps extends BoxProps {
	graph: RrdGraphView;
	/** Every record kind in the estate, so a kind keeps its color in any subgraph. */
	kinds: string[];
	selected: string | null;
	onSelect: (record: string | null) => void;
}

/**
 * Records and relations from the diagnostic graph snapshot, laid out with
 * ForceAtlas2. Node size follows degree; color follows record kind.
 */
export function RecordGraph({ graph, kinds, selected, onSelect, ...other }: RecordGraphProps) {
	const ref = useRef<HTMLDivElement>(null);
	const sigmaRef = useRef<Sigma<RecordNode, RelationEdge> | null>(null);
	const focusRef = useRef({ hovered: "", neighbours: new Set<string>(), selected });
	const theme = useMantineTheme();
	const isLight = useIsLight();
	const handleSelect = useStable(onSelect);

	const kindColors = useMemo(
		() =>
			new Map(
				kinds.map((kind, index) => {
					const name = KIND_COLORS[index % KIND_COLORS.length];
					return [kind, theme.colors[name]?.[6] ?? theme.colors.obsidian[4]];
				}),
			),
		[kinds, theme.colors],
	);

	const kindCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const node of graph.nodes) {
			counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
		}
		return counts;
	}, [graph.nodes]);

	const layout = useMemo(() => {
		const model = new MultiDirectedGraph<RecordNode, RelationEdge>();
		for (const node of graph.nodes) {
			model.addNode(node.id, {
				label: node.label,
				kind: node.kind,
				x: 0,
				y: 0,
				size: 3,
				color: kindColors.get(node.kind) ?? theme.colors.obsidian[4],
			});
		}
		for (const edge of graph.edges) {
			if (model.hasNode(edge.from) && model.hasNode(edge.to)) {
				model.addDirectedEdgeWithKey(edge.id, edge.from, edge.to, {
					kind: edge.kind,
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
					barnesHutOptimize: model.order > BARNES_HUT_THRESHOLD,
				},
			});
		}
		return model;
	}, [graph.nodes, graph.edges, kindColors, theme.colors.obsidian]);

	const edgeColor = isLight ? theme.colors.obsidian[2] : theme.colors.obsidian[6];
	const labelColor = isLight ? theme.colors.obsidian[9] : theme.colors.obsidian[0];

	// Selection may come from the graph or from the record search: highlight
	// the record's neighbourhood and bring it into view either way.
	useEffect(() => {
		const instance = sigmaRef.current;
		focusRef.current.selected = selected;
		focusRef.current.neighbours =
			selected && layout.hasNode(selected) ? new Set(layout.neighbors(selected)) : new Set();
		if (!instance) return;
		instance.refresh({ skipIndexation: true });
		const display = selected ? instance.getNodeDisplayData(selected) : undefined;
		if (display) {
			instance
				.getCamera()
				.animate({ x: display.x, y: display.y, ratio: 0.35 }, { duration: 400 });
		}
	}, [selected, layout]);

	useEffect(() => {
		if (!ref.current) return;

		const instance = new Sigma<RecordNode, RelationEdge>(layout, ref.current, {
			allowInvalidContainer: true,
			defaultEdgeType: "arrow",
			defaultEdgeColor: edgeColor,
			labelColor: { color: labelColor },
			labelFont: "JetBrains Mono",
			labelSize: 10,
			labelDensity: 0.35,
			labelGridCellSize: 120,
			labelRenderedSizeThreshold: 11,
			stagePadding: 32,
			defaultDrawNodeHover: drawHover,
			defaultDrawNodeLabel: drawLabel,
			nodeReducer: (node, data) => {
				const display: Partial<NodeDisplayData> = { ...data };
				const focus = focusRef.current;
				const anchor = focus.hovered || focus.selected;
				if (anchor && node !== anchor && !focus.neighbours.has(node)) {
					display.label = "";
					display.color = getIsLight()
						? theme.colors.obsidian[1]
						: theme.colors.obsidian[7];
				}
				if (node === focus.selected) {
					display.highlighted = true;
				}
				return display;
			},
			edgeReducer: (edge, data) => {
				const display: Partial<EdgeDisplayData> = { ...data };
				const focus = focusRef.current;
				const anchor = focus.hovered || focus.selected;
				if (anchor && !layout.extremities(edge).includes(anchor)) {
					display.hidden = true;
				}
				return display;
			},
		});

		const focusOn = (node: string) => {
			focusRef.current.neighbours = new Set(layout.neighbors(node));
		};

		instance.on("enterNode", ({ node }) => {
			focusRef.current.hovered = node;
			focusOn(node);
			instance.refresh({ skipIndexation: true });
		});
		instance.on("leaveNode", () => {
			focusRef.current.hovered = "";
			const current = focusRef.current.selected;
			focusRef.current.neighbours = current ? new Set(layout.neighbors(current)) : new Set();
			instance.refresh({ skipIndexation: true });
		});
		instance.on("clickNode", ({ node }) => {
			focusOn(node);
			handleSelect(node);
		});
		instance.on("clickStage", () => {
			focusRef.current.neighbours = new Set();
			handleSelect(null);
		});

		sigmaRef.current = instance;
		return () => {
			instance.kill();
			sigmaRef.current = null;
		};
	}, [layout, edgeColor, labelColor, theme.colors.obsidian]);

	return (
		<Box
			pos="relative"
			{...other}
		>
			<Box
				ref={ref}
				h="100%"
			/>
			<Group
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
					label="Fit graph"
					variant="subtle"
					onClick={() => sigmaRef.current?.getCamera().animatedReset()}
				>
					<Icon path={iconFullscreen} />
				</ActionButton>
			</Group>
			<Paper
				pos="absolute"
				bottom={8}
				left={8}
				px="sm"
				py={6}
				bg={isLight ? "obsidian.0" : "obsidian.8"}
			>
				<Stack gap={2}>
					{[...kindColors.entries()]
						.filter(([kind]) => kindCounts.has(kind))
						.map(([kind, color]) => (
							<Group
								key={kind}
								gap={6}
							>
								<Box
									w={8}
									h={8}
									bg={color}
									style={{ borderRadius: "50%" }}
								/>
								<Text
									fz="xs"
									ff="monospace"
								>
									{kind} · {kindCounts.get(kind) ?? 0}
								</Text>
							</Group>
						))}
				</Stack>
			</Paper>
		</Box>
	);
}
