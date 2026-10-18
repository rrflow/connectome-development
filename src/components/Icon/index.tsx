import { Box, type BoxProps, type MantineColor, type MantineFontSize } from "@mantine/core";
import type { HTMLAttributes } from "react";
import classes from "./style.module.scss";

export interface IconProps extends BoxProps, Omit<HTMLAttributes<SVGElement>, "style" | "color"> {
	/** A 24×24 SVG path from `~/icons`. */
	path: string;
	/** A Mantine font size name or a multiplier of the current font size. */
	size?: MantineFontSize | number;
	/** A Mantine color; defaults to the current text color. */
	color?: MantineColor;
	spin?: boolean;
	flip?: "horizontal" | "vertical" | "both";
}

const SIZES: Record<string, string> = {
	xs: "0.75em",
	sm: "1em",
	md: "1.25em",
	lg: "1.5em",
	xl: "2em",
};

const FLIPS: Record<string, string> = {
	horizontal: "scaleX(-1)",
	vertical: "scaleY(-1)",
	both: "scale(-1, -1)",
};

/**
 * Draws one icon from `~/icons` as an inline SVG that follows the surrounding
 * text size and color unless told otherwise.
 */
export function Icon({ path, size = "md", color, spin, flip, className, ...other }: IconProps) {
	const dimension = typeof size === "number" ? `${size * 1.25}em` : (SIZES[size] ?? SIZES.md);

	return (
		<Box
			component="svg"
			viewBox="0 0 24 24"
			role="img"
			aria-hidden={other["aria-label"] ? undefined : true}
			className={[classes.icon, spin ? classes.spin : "", className ?? ""].join(" ").trim()}
			c={color}
			w={dimension}
			h={dimension}
			style={flip ? { transform: FLIPS[flip] } : undefined}
			{...other}
		>
			<path
				d={path}
				fill="currentColor"
			/>
		</Box>
	);
}
