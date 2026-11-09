import { Box, rem } from "@mantine/core";
import classes from "./style.module.scss";

export interface TopGlowProps {
	offset?: number | null;
}

/**
 * The soft brand glow at the top of a screen, drawn with CSS gradients in
 * Connectome's accent colors; no image asset.
 */
export function TopGlow({ offset }: TopGlowProps) {
	if (offset === null) return null;

	return (
		<Box
			className={classes.glow}
			__vars={{
				"--offset": rem(offset ? -offset : 0),
			}}
		/>
	);
}
