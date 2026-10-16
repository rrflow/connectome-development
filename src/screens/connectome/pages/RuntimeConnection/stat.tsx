import { Paper, Text } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./style.module.scss";

export interface StatProps {
	label: string;
	value: ReactNode;
	/** Full value shown on hover when `value` is abbreviated. */
	title?: string;
}

export function Stat({ label, value, title }: StatProps) {
	return (
		<Paper
			p="md"
			className={classes.stat}
		>
			<Text
				fz="xs"
				tt="uppercase"
				c="slate"
			>
				{label}
			</Text>
			<Text
				fz="lg"
				fw={700}
				ff="monospace"
				c="bright"
				title={title}
				truncate
			>
				{value}
			</Text>
		</Paper>
	);
}
