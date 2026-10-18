/// <reference types="vite/client" />

interface ImportMetaEnv {
	DATE: string;
	VERSION: string;
	CHANNEL: string;
	/** RRFlow's product version at the pinned engine revision (`src-tauri/Cargo.lock`). */
	RRFLOW_ENGINE_VERSION: string;
	/** The exact `rrflow/rrflow-development` commit Connectome is contracted to. */
	RRFLOW_ENGINE_REVISION: string;
	MODE: string;
	GTM_ID: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
