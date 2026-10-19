import { isDesktop } from "~/adapter";
import { Scaffold } from "~/components/Scaffold";
import { ConnectomeScreen } from "~/screens/connectome";
import { Globals } from "./globals";
import { CommandPaletteModal } from "./modals/commands";
import { ConnectionsModal } from "./modals/connections";
import { ConsoleDrawer } from "./modals/console";
import { UpdaterDialog } from "./modals/updater";
import { Settings } from "./settings";

function Connectome() {
	return <ConnectomeScreen />;
}

export function App() {
	return (
		<Scaffold>
			<Globals />

			<Connectome />

			<Settings />

			<ConnectionsModal />
			<CommandPaletteModal />
			<ConsoleDrawer />

			{isDesktop && <UpdaterDialog />}
		</Scaffold>
	);
}
