import { Box, Button, Stack, Text } from "@mantine/core";
import { Icon, iconCheck, iconReset, iconWrench } from "@surrealdb/ui";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { adapter, isDesktop } from "~/adapter";
import type { DesktopAdapter } from "~/adapter/desktop";
import { LearnMore } from "~/components/LearnMore";
import { useVersionCopy } from "~/hooks/debug";
import { useStable } from "~/hooks/stable";
import { RRD_PROTOCOL, RRD_PROTOCOL_VERSION } from "~/rrflow/runtime";
import { isDevelopment, isPreview } from "~/shared/util/environment";
import classes from "../style.module.scss";

export function AboutTab() {
	const currDate = new Date();
	const [copyDebug, clipboard] = useVersionCopy();
	const [isChecking, setChecking] = useState(false);

	const versionText = useMemo(() => {
		let builder = `${import.meta.env.VERSION} ${import.meta.env.CHANNEL}`;

		if (isPreview) {
			builder += " (pre)";
		} else if (isDevelopment) {
			builder += " (dev)";
		}

		return builder;
	}, []);

	const information = useMemo(
		() => [
			["Version", versionText],
			["Build date", format(import.meta.env.DATE, "MMMM do, yyyy")],
			["Build time", format(import.meta.env.DATE, "HH:mm:ss OOO")],
			["Build mode", import.meta.env.MODE],
			["RRD protocol", `${RRD_PROTOCOL} v${RRD_PROTOCOL_VERSION}`],
			[
				"RRFlow engine",
				`${import.meta.env.RRFLOW_ENGINE_VERSION} (${import.meta.env.RRFLOW_ENGINE_REVISION.slice(0, 7)})`,
			],
		],
		[versionText],
	);

	const checkForUpdates = useStable(() => {
		setChecking(true);

		(adapter as DesktopAdapter).checkForUpdates(true).finally(() => {
			setChecking(false);
		});
	});

	return (
		<Box m="xs">
			<Text c="obsidian">Connectome &copy; {format(currDate, "yyyy")} AngryVibes LLC</Text>
			<Stack
				gap="xs"
				mt="xl"
			>
				{information.map(([label, value]) => (
					<Text key="key">
						{label}:{" "}
						<Text
							className={classes.aboutValue}
							c="bright"
							span
						>
							{value}
						</Text>
					</Text>
				))}
			</Stack>
			<Stack mt="xl">
				<LearnMore href="https://github.com/rrflow/connectome-development">
					GitHub Repository
				</LearnMore>
				<LearnMore href="https://github.com/rrflow/rrflow-development">
					RRFlow engine repository
				</LearnMore>
			</Stack>
			<Stack
				mt="xl"
				maw={250}
			>
				<Button
					onClick={copyDebug}
					rightSection={<Icon path={clipboard.copied ? iconCheck : iconWrench} />}
					color={clipboard.copied ? "rrflow" : "obsidian"}
					variant="light"
					size="xs"
				>
					Copy environment information
				</Button>
				{isDesktop && (
					<Button
						onClick={checkForUpdates}
						color="obsidian"
						variant="light"
						size="xs"
						rightSection={
							<Icon
								path={iconReset}
								spin={isChecking}
							/>
						}
					>
						Check for updates
					</Button>
				)}
			</Stack>
		</Box>
	);
}
