import { Box } from "@mantine/core";
import { useMemo } from "react";
import { Article, DocsPreview } from "~/features/documentation/content/components";
import type { Snippets, TopicProps } from "~/features/documentation/content/types";
import { useConnection } from "~/hooks/connection";
import { createBaseAuthentication } from "~/shared/util/defaults";
import { connectionUri } from "~/shared/util/helpers";

export function DocsGlobalConnecting({ language }: TopicProps) {
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
			await db.connect(${esc_endpoint}, {
				namespace: ${esc_namespace},
				database: ${esc_database}
			});
		`,
			rust: `
			let db = any::connect(${esc_endpoint}).await?;
			db.use_ns(${esc_namespace}).use_db(${esc_database}).await?;
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
				db.use('${esc_namespace}', '${esc_database}')
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
		$db->connect("http://localhost:8000", [
			"namespace" => "test",
			"database" => "test"
		]);
		`,
		}),
		[esc_endpoint, esc_namespace, esc_database],
	);

	return (
		<Article title="Connecting">
			<div>
				<p>
					The connection API is used to establish a connection to a RRFlow instance. The
					connection is used to interact with the database and perform operations on the
					data. While connecting to the database, the user can specify the namespace and
					database to connect to, as well as the authentication details for the
					connection.
				</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="Opening a connection"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
