import { Text, type TextProps } from "@mantine/core";
import classes from "./style.module.scss";

export interface WordmarkProps extends Omit<TextProps, "size"> {
	/** Font size in pixels. */
	size?: number;
}

/**
 * The Connectome wordmark, set in the interface font with the brand gradient.
 * Text, not an image, so it follows the color scheme and never needs an asset.
 */
export function Wordmark({ size = 20, className, ...other }: WordmarkProps) {
	return (
		<Text
			component="span"
			className={[classes.wordmark, className ?? ""].join(" ").trim()}
			fz={size}
			fw={750}
			lh={1}
			{...other}
		>
			CONNECTOME
		</Text>
	);
}
