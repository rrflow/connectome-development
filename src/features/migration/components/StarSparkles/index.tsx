import { Box } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { visibleInterval } from "~/shared/util/platform/visibility";
import { useConfigStore } from "~/shell/stores/config";
import classes from "./style.module.scss";

/**
 * How often a sparkle is added. Decoration only, so its one control is the
 * Appearance setting "Disable animations", which stops it altogether.
 */
const SPARKLE_EVERY_MS = 800;

interface Star {
	id: number;
	x: number;
	y: number;
}

export interface StarSparkleProps {
	children: React.ReactNode;
	ref?: React.RefObject<any>;
	hidden?: boolean;
	inset?: number;
	offsetBase?: number;
	offsetModifier?: number;
}

export function StarSparkles({
	hidden,
	children,
	inset = 0,
	offsetBase = 8,
	offsetModifier = 4,
}: StarSparkleProps) {
	const disableAnimations = useConfigStore((s) => s.settings.appearance.disableAnimations);

	const ref = useRef<HTMLDivElement>(null);
	const [stars, setStars] = useState<Star[]>([]);
	const [starId, setStarId] = useState(0);

	useEffect(() => {
		if (!ref.current || hidden || disableAnimations) return;

		return visibleInterval(() => {
			if (!ref.current) return;

			const width = ref.current.offsetWidth;
			const height = ref.current.offsetHeight;

			const baseOffset = offsetBase + Math.random() * offsetModifier;
			const edge = Math.floor(Math.random() * 4);
			let x: number, y: number;

			if (edge === 0) {
				x = Math.random() * width;
				y = -baseOffset + inset;
			} else if (edge === 1) {
				x = width + baseOffset - inset;
				y = Math.random() * height;
			} else if (edge === 2) {
				x = Math.random() * width;
				y = height + baseOffset - inset;
			} else {
				x = -baseOffset + inset;
				y = Math.random() * height;
			}

			const newStar: Star = {
				id: starId,
				x: x,
				y: y,
			};

			setStars((prev) => [...prev, newStar]);
			setStarId((prev) => prev + 1);

			setTimeout(() => {
				setStars((prev) => prev.filter((star) => star.id !== newStar.id));
			}, 3000);
		}, SPARKLE_EVERY_MS);
	}, [starId, hidden, inset, offsetBase, offsetModifier, disableAnimations]);

	return (
		<div
			className={classes.starContainer}
			ref={ref}
		>
			{children}
			{stars.map((star) => (
				<Box
					key={star.id}
					className={classes.star}
					style={{
						left: `${star.x}px`,
						top: `${star.y}px`,
					}}
				>
					★
				</Box>
			))}
		</div>
	);
}
