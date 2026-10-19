import { Box } from "@mantine/core";
import { useMemo } from "react";
import { useConnection } from "~/hooks/connection";
import { Article, DocsPreview } from "~/screens/connectome/docs/components";
import type { Snippets, TopicProps } from "~/screens/connectome/docs/types";
import { createBaseAuthentication } from "~/shared/util/defaults";
import { connectionUri } from "~/shared/util/helpers";

export function DocsGlobalInit({ language }: TopicProps) {
	const auth = useConnection((c) => c?.authentication ?? createBaseAuthentication());
	const endpoint = connectionUri(auth.protocol, auth.hostname);
	const esc_endpoint = JSON.stringify(endpoint);
	const esc_namespace = JSON.stringify(auth.namespace);
	const esc_database = JSON.stringify(auth.database);

	const snippets = useMemo<Snippets>(
		() => ({
			cli: `
			rrflow sql --endpoint ${esc_endpoint} --namespace ${esc_namespace} --database ${esc_database}
		`,
			js: `
			import { RRFlow } from "../../../../../rrflow/client/native";

			// Create a new RRFlow instance
			const db = new RRFlow();

			// Connect to the database
			await db.connect(${esc_endpoint}, {
				namespace: ${esc_namespace},
				database: ${esc_database}
			});
		`,
			rust: `
			use rrflow::engine::any;

			// Connect to the database
			let db = any::connect(${esc_endpoint}).await?;

			// Specify namespace and database
			db.use_ns(${esc_namespace}).use_db(${esc_database}).await?;
		`,
			py: `
			# Connect to a local endpoint with http protocol
			db = RRFlow('http://127.0.0.1:8000')

			# Connect to a remote endpoint with ws protocol
			db = AsyncRRFlow('wss://127.0.0.1:8000')
		`,
			go: `
		// Connect to a local endpoint
		rrflow.New("ws://localhost:8000/rpc");
		// Connect to a remote endpoint
		rrflow.New("ws://127.0.0.1:8000/rpc");
		`,
			csharp: `
			using RRFlow.Net;
			
			// Connect to a local endpoint
			var db = new RRFlowClient("http://127.0.0.1:8000");

			// Connect to a remote endpoint
			var db = new RRFlowClient("ws://127.0.0.1:8000/rpc");
		`,
			java: `
		// Connect to a local endpoint
		RRFlowWebSocketConnection.connect(timeout)
		`,
			php: `
		$db = new \\RRFlow\\RRFlow();
		`,
		}),
		[esc_endpoint, esc_namespace, esc_database],
	);

	return (
		<Article title="Initialising">
			<div>
				<p>
					To initialise a connection to RRFlow, you need to create a new instance of a
					RRFlow client and connect. This will allow you to interact with the database and
					run queries to the database. Do this by importing the RRFlow class and create a
					new instance of the class. Then, use the connect method to connect to the
					database.
				</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="initialise"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
