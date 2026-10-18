import { isDesktop } from "~/adapter";
import { Scaffold } from "~/components/Scaffold";
import { DesignerProvider } from "~/providers/Designer";
import { InspectorProvider } from "~/providers/Inspector";
import { ConnectomeScreen } from "~/screens/connectome";
import { Globals } from "./globals";
import { CommandPaletteModal } from "./modals/commands";
import { ConnectionsModal } from "./modals/connections";
import { ConsoleDrawer } from "./modals/console";
import { DataExportModal } from "./modals/data-export";
import { DataImportModal } from "./modals/data-import";
import { HighlightToolModal } from "./modals/highlight-tool";
import { RegisterUserModal } from "./modals/register";
import { SandboxModal } from "./modals/sandbox";
import { AccessSignupModal } from "./modals/signup";
import { TableCreatorModal } from "./modals/table";
import { UpdaterDialog } from "./modals/updater";
import { Settings } from "./settings";

function Connectome() {
	return (
		<InspectorProvider>
			<DesignerProvider>
				<ConnectomeScreen />
			</DesignerProvider>
		</InspectorProvider>
	);
}

export function App() {
	return (
		<Scaffold>
			<Globals />

			<Connectome />

			<Settings />

			<ConnectionsModal />
			<CommandPaletteModal />
			<SandboxModal />
			<AccessSignupModal />
			<TableCreatorModal />
			<HighlightToolModal />
			<DataExportModal />
			<DataImportModal />
			<RegisterUserModal />
			<ConsoleDrawer />

			{isDesktop && <UpdaterDialog />}
		</Scaffold>
	);
}
