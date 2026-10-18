import { Icon } from "~/components/Icon";
import { useStable } from "~/hooks/stable";
import { iconChevronRight } from "~/icons";
import { useInterfaceStore } from "~/shell/stores/interface";
import { ActionButton } from "../ActionButton";

export function SidebarToggle() {
	const { setOverlaySidebar } = useInterfaceStore.getState();
	const overlaySidebar = useInterfaceStore((s) => s.overlaySidebar);

	const toggleSidebar = useStable(() => {
		setOverlaySidebar(!overlaySidebar);
	});

	return (
		<ActionButton
			size="lg"
			hiddenFrom="md"
			label="Toggle sidebar"
			onClick={toggleSidebar}
		>
			<Icon path={iconChevronRight} />
		</ActionButton>
	);
}
