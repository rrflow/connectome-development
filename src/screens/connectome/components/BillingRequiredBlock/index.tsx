import { BoxProps, Image, Paper, Stack, Text } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import glowImage from "~/shared/assets/images/glow.png";
import { pictoRRFlowCloud } from "../../../../rrflow/ui/index";
import classes from "./style.module.scss";

export interface BillingRequiredBlockProps extends BoxProps {
	title: string;
	subtitle: ReactNode;
}

export function BillingRequiredBlock({
	title,
	subtitle,
	...other
}: PropsWithChildren<BillingRequiredBlockProps>) {
	return (
		<Paper
			p="xl"
			pos="relative"
			className={classes.cloud}
			{...other}
		>
			<Stack flex={1}>
				<Text
					fz="xl"
					c="bright"
					fw="bold"
					maw={450}
				>
					{title}
				</Text>
				{subtitle}
			</Stack>
			<Image
				src={pictoRRFlowCloud}
				className={classes.cloudImage}
			/>
			<Image
				src={glowImage}
				className={classes.cloudGlow}
			/>
		</Paper>
	);
}
