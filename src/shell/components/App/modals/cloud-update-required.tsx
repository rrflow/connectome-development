import { ActionIcon, Box, Dialog, Group, Image, Text } from "@mantine/core";
import { Icon, iconClose, pictoSDBCloud } from "@surrealdb/ui";
import { type MouseEvent, useMemo } from "react";
import { isDesktop } from "~/adapter";
import { useStable } from "~/hooks/stable";
import { useDesktopUpdater } from "~/hooks/updater";
import { useInterfaceStore } from "~/shell/stores/interface";
import { useCloudStore } from "~/stores/cloud";
import classes from "../style.module.scss";

export function CloudUpdateRequiredDialog() {
	const { setIsSupported } = useCloudStore.getState();

	const isOpen = useCloudStore((s) => !s.isSupported);
	const update = useInterfaceStore((s) => s.availableUpdate);

	const noUpdate = useMemo(() => {
		return !isDesktop || !update?.available;
	}, [update]);

	const { phase, progress, version, startUpdate } = useDesktopUpdater();

	const onClose = useStable((e?: MouseEvent) => {
		e?.stopPropagation();
		setIsSupported(true);
	});

	return (
		<Dialog
			opened={isOpen}
			onClose={onClose}
			size={600}
			shadow="sm"
			radius="md"
			position={{
				left: "calc(50% - 263px)",
				right: "calc(50% + 300px)",
				bottom: 32,
			}}
			transitionProps={{
				transition: "slide-up",
				timingFunction: "ease",
				duration: 200,
			}}
			classNames={{
				root: classes.updateDialog,
			}}
			style={{
				cursor: noUpdate ? "not-allowed" : "pointer",
			}}
			onClick={noUpdate ? undefined : startUpdate}
		>
			<Group>
				<Image
					src={pictoSDBCloud}
					alt="RRFlow Cloud"
					w={48}
				/>
				<Box flex="1">
					<Text
						fw={600}
						c="bright"
					>
						Connectome update required for RRFlow Cloud
					</Text>
					<Text mt={4}>
						{noUpdate ? (
							<Text c="red">
								No update available. Please contact{" "}
								<a href="mailto:developer@example.com">developer@example.com</a> for
								assistance
							</Text>
						) : phase === "downloading" ? (
							<Text c="gray.5">Installing... ({progress}%)</Text>
						) : phase === "error" ? (
							<Text c="red">Failed to install update</Text>
						) : (
							<Text c="gray.5">Click to install version {version}</Text>
						)}
					</Text>
				</Box>
				<ActionIcon
					size="lg"
					onClick={onClose}
				>
					<Icon path={iconClose} />
				</ActionIcon>
			</Group>
		</Dialog>
	);
}
