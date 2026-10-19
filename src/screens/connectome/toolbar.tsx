import { Button } from "@mantine/core";
import { ActionBar } from "~/components/ActionBar";
import { Icon } from "~/components/Icon";
import { SidebarToggle } from "~/components/SidebarToggle";
import { Spacer } from "~/components/Spacer";
import { useStable } from "~/hooks/stable";
import { iconStar } from "~/icons";
import { useFeatureFlags } from "~/shared/util/feature-flags";
import { dispatchIntent } from "~/shared/util/intents";
import { useInterfaceStore } from "~/shell/stores/interface";

/**
 * The strip above every page: the sidebar toggle, the release note prompt,
 * and the action bar (serving the local estate). Everything estate-specific
 * lives on the runtime page itself.
 */
export function ConnectomeToolbar() {
	const { readChangelog } = useInterfaceStore.getState();
	const [flags] = useFeatureFlags();

	const showChangelog = useInterfaceStore((s) => s.showChangelogAlert);
	const hasReadChangelog = useInterfaceStore((s) => s.hasReadChangelog);

	const openChangelog = useStable(() => {
		dispatchIntent("open-changelog");
		readChangelog();
	});

	return (
		<>
			<SidebarToggle />

			<Spacer />

			{(flags.changelog === "auto" ? showChangelog : flags.changelog !== "hidden") && (
				<Button
					h={34}
					size="xs"
					variant={
						(flags.changelog === "auto" ? hasReadChangelog : flags.changelog === "read")
							? "light"
							: "gradient"
					}
					style={{ border: "none" }}
					onClick={openChangelog}
					leftSection={
						<Icon
							path={iconStar}
							size="lg"
						/>
					}
				>
					See what's new in {import.meta.env.VERSION}
				</Button>
			)}

			<ActionBar />
		</>
	);
}
