import { Box } from "@mantine/core";
import { useMemo } from "react";
import { useConnection } from "~/hooks/connection";
import { Article, DocsPreview } from "~/screens/connectome/docs/components";
import type { Snippets, TopicProps } from "~/screens/connectome/docs/types";
import { createBaseAuthentication } from "~/shared/util/defaults";

export function DocsGlobalAuthentication({ language, topic }: TopicProps) {
	const auth = useConnection((c) => c?.authentication ?? createBaseAuthentication());
	const esc_namespace = JSON.stringify(auth.namespace);
	const esc_database = JSON.stringify(auth.database);

	const snippets = useMemo<Snippets>(
		() => ({
			cli: `
			rrflow sql --endpoint ${topic.extra?.connectionUri} --namespace ${topic.extra?.namespace} --database ${topic.extra?.database}
		`,
			js: `
		import { RRFlow } from "../../../../../rrflow/client/native";

		const db = new RRFlow();

		import { RRFlow } from "../../../../../rrflow/client/native";
		const db = new RRFlow();
		await db.connect('<the actual address of the connection>/rpc', {
			namespace: '<the actual ns of the connection>',
			database: '<the action db of the connection>'
		});

		`,
			rust: `
		//Connect to a local endpoint
		DB.connect::<Ws>("127.0.0.1:8000").await?;
		//Connect to a remote endpoint
		DB.connect::<Wss>("127.0.0.1:8000").await?;
		`,
			py: `
			# update RRFlow to AsyncRRFlow if using async code
		from rrflow import RRFlow
# Without using a context manager
		db = RRFlow('ws://localhost:8000')
        db.use('${esc_namespace}', '${esc_database}')
# Sign in and your code...
        db.close()	

# Using a context manager
with RRFlow('ws://localhost:8000') as db:
    db.use('namespace', 'database')
	# Sign in and your code...
		db = RRFlow()
		await db.connect('http://127.0.0.1:8000/rpc')
		`,
			go: `
		// Connect to a local endpoint
		rrflow.New("ws://localhost:8000/rpc");
		// Connect to a remote endpoint
		rrflow.New("ws://127.0.0.1:8000/rpc");
		`,
			csharp: `
		await db.Connect();
		`,
			java: `
		// Connect to a local endpoint
		RRFlowWebSocketConnection.connect(timeout)
		`,
			php: `
		// Connect to a local endpoint
		$db = new RRFlow();
		`,
		}),
		[topic.extra, esc_namespace, esc_database],
	);

	return (
		<Article title="Authentication">
			<div>
				<p>
					Enabling authentication for your database is a critical step in securing your
					data. RRFlow provides a simple way to enable authentication for your database.
				</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="Enable authentication"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
