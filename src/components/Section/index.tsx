import { Box, Group, Stack, Text } from "@mantine/core";
import type { PropsWithChildren, ReactNode } from "react";
import { useIsLight } from "~/hooks/theme";

export interface SectionProps {
	title: ReactNode;
	description?: ReactNode;
	rightSection?: ReactNode;
	withMaxWidth?: boolean;
	compact?: boolean;
}

export function Section({
	title,
	description,
	rightSection,
	withMaxWidth,
	compact = false,
	children,
}: PropsWithChildren<SectionProps>) {
	const isLight = useIsLight();

	return (
		<Box>
			<Group>
				<Box flex={1}>
					<Text
						fw={700}
						fz={17}
						c={isLight ? "obsidian.9" : "obsidian.0"}
					>
						{title}
					</Text>
					{description && (
						<Text
							fz={compact ? "sm" : "lg"}
							mt={compact ? 4 : "xs"}
						>
							{description}
						</Text>
					)}
				</Box>
				{rightSection}
			</Group>
			<Stack
				py={compact ? "sm" : "xl"}
				gap={compact ? "sm" : "md"}
				maw={withMaxWidth ? 500 : undefined}
			>
				{children}
			</Stack>
		</Box>
	);
}
