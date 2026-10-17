import type { Settings } from "sigma/settings";
import type { NodeDisplayData, PartialButFor } from "sigma/types";
import { drawHover, drawLabel } from "~/components/RelationGraph/drawing";

/*
 * Label placement for the runtime graphs. sigma chooses which labels to try
 * (its density grid plus forced labels) and draws each one wherever its node
 * sits, so the labels of nearby nodes run into each other and into the
 * canvas's own controls. This layer collects the labels sigma asks for during
 * a frame and draws them when the frame ends, highest priority first: each
 * label goes right of its node, or left of it when the right side is taken,
 * and is left out when neither side is clear of the canvas edges, the
 * controls, the boxed label of the selected or hovered node, and every label
 * already drawn.
 */

type LabelData = PartialButFor<NodeDisplayData, "x" | "y" | "size" | "label" | "color">;
/** The renderers read only display settings, so they serve every graph type. */
type AnySettings = Settings<any, any, any>;

/** Clear space kept around each label, in pixels. */
const LABEL_GAP = 2;
/** Gap drawLabel leaves between a node's edge and its text. */
const LABEL_OFFSET = 3;
/** Padding drawHover puts around its boxed label. */
const HOVER_PADDING = 4;

/** A rectangle in the canvas's CSS pixels, origin at its top-left corner. */
export interface ScreenBox {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

function overlaps(a: ScreenBox, b: ScreenBox) {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function setFont(context: CanvasRenderingContext2D, data: LabelData, settings: AnySettings) {
	const size =
		typeof data.labelSize === "number" && data.labelSize > 0
			? data.labelSize
			: settings.labelSize;
	context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
	return size;
}

/** The area drawHover paints: the node's disc plus its boxed label. */
function hoverBox(
	context: CanvasRenderingContext2D,
	data: LabelData,
	settings: AnySettings,
): ScreenBox {
	const size = setFont(context, data, settings);
	const radius = Math.max(data.size, size / 2) + HOVER_PADDING;
	const label = data.label || data.hoverLabel;
	const width = typeof label === "string" ? Math.round(context.measureText(label).width + 5) : 0;
	const half = Math.max(radius, Math.round(size + 2 * HOVER_PADDING) / 2);
	return {
		left: data.x - radius - LABEL_GAP,
		right: data.x + radius + width + LABEL_GAP,
		top: data.y - half - LABEL_GAP,
		bottom: data.y + half + LABEL_GAP,
	};
}

/**
 * Where a label fits: right of its node, else left of it, else nowhere. The
 * returned data places drawLabel's text, which always starts right of `x`.
 */
function place(
	context: CanvasRenderingContext2D,
	data: LabelData,
	settings: AnySettings,
	canvas: { width: number; height: number },
	taken: ScreenBox[],
): { box: ScreenBox; data: LabelData } | null {
	const size = setFont(context, data, settings);
	const text = context.measureText(data.label ?? "").width;
	const reach = data.size + LABEL_OFFSET;
	const sides = [
		{ start: data.x + reach, x: data.x },
		{ start: data.x - reach - text, x: data.x - 2 * reach - text },
	];
	for (const side of sides) {
		const box = {
			left: side.start - LABEL_GAP,
			right: side.start + text + LABEL_GAP,
			top: data.y - size / 2 - LABEL_GAP,
			bottom: data.y + size / 2 + LABEL_GAP,
		};
		if (box.left < 0 || box.top < 0 || box.right > canvas.width || box.bottom > canvas.height) {
			continue;
		}
		if (taken.some((other) => overlaps(box, other))) continue;
		return { box, data: { ...data, x: side.x } };
	}
	return null;
}

interface PendingLabel {
	key: string;
	data: LabelData;
	settings: AnySettings;
}

export interface LabelLayer {
	/** sigma's `defaultDrawNodeLabel`: queues the label for the end of the frame. */
	drawLabel: (context: CanvasRenderingContext2D, data: LabelData, settings: AnySettings) => void;
	/** sigma's `defaultDrawNodeHover`: draws the boxed label and keeps its area clear. */
	drawHover: (context: CanvasRenderingContext2D, data: LabelData, settings: AnySettings) => void;
	/** Bind to sigma's `beforeRender`: forgets the previous frame. */
	beginFrame: () => void;
	/** Bind to sigma's `afterRender`: draws the queued labels that fit. */
	endFrame: () => void;
}

/**
 * A label layer for one sigma instance. `priority` ranks nodes when their
 * labels compete for the same space; the higher label is drawn. `obstacles`
 * lists the areas the canvas's own controls cover, read once per frame.
 */
export function createLabelLayer(
	priority: (node: string) => number,
	obstacles: () => ScreenBox[],
): LabelLayer {
	let pending: PendingLabel[] = [];
	let reserved: { key: string; box: ScreenBox }[] = [];
	let target: CanvasRenderingContext2D | null = null;

	return {
		drawLabel(context, data, settings) {
			if (!data.label || typeof data.key !== "string") return;
			target = context;
			pending.push({ key: data.key, data: { ...data }, settings });
		},
		drawHover(context, data, settings) {
			if (typeof data.key === "string") {
				reserved.push({ key: data.key, box: hoverBox(context, data, settings) });
			}
			drawHover(context, data, settings);
		},
		beginFrame() {
			pending = [];
			reserved = [];
			target = null;
		},
		endFrame() {
			const context = target;
			if (!context) return;
			const taken = [...obstacles(), ...reserved.map((entry) => entry.box)];
			const canvas = {
				width: context.canvas.clientWidth,
				height: context.canvas.clientHeight,
			};
			// The hover layer already draws these nodes' labels, boxed.
			const boxed = new Set(reserved.map((entry) => entry.key));
			const queue = pending
				.filter((entry) => !boxed.has(entry.key))
				.sort((a, b) => priority(b.key) - priority(a.key) || a.key.localeCompare(b.key));
			for (const entry of queue) {
				const placement = place(context, entry.data, entry.settings, canvas, taken);
				if (!placement) continue;
				taken.push(placement.box);
				drawLabel(context, placement.data, entry.settings);
			}
			pending = [];
		},
	};
}
