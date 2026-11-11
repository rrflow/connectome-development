import { Box } from "@mantine/core";
import { useMemo } from "react";
import { Article, DocsPreview } from "~/features/documentation/content/components";
import type { Snippets, TopicProps } from "~/features/documentation/content/types";
import { useDatabaseSchema } from "~/hooks/connection/schema";

export function DocsGlobalHandlingErrors({ language, topic }: TopicProps) {
	const schema = useDatabaseSchema();

	const snippets = useMemo<Snippets>(
		() => ({
			cli: `
			rrflow sql --endpoint ${topic.extra?.connectionUri} --namespace ${topic.extra?.namespace} --database ${topic.extra?.database}
		`,
			js: `
			// some comment
			import { db } from './database';

			// more code
			db.select("${schema?.tables?.[0]?.schema?.name}").then((rows) => {
				console.log(rows);
			});
		`,
		}),
		[topic.extra, schema?.tables],
	);

	return (
		<Article title="Handling errors">
			<div>
				<p>
					Handling errors is an important part of any application. Here's how to handle
					errors in RRFlow.
				</p>
				<p>{topic.extra?.table?.schema?.name}</p>
			</div>
			<Box>
				<DocsPreview
					language={language}
					title="Handling errors"
					values={snippets}
				/>
			</Box>
		</Article>
	);
}
