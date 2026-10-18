import { Link } from "~/components/Link";
import { Article } from "~/screens/connectome/docs/components";
import type { TopicProps } from "~/screens/connectome/docs/types";

export function DocsConceptsRRFlowML(_: TopicProps) {
	return (
		<Article title="RRFlow ML">
			<div>
				<p>
					RRFlowML is an engine that seeks to do one thing, and one thing well: store and
					execute trained ML models. RRFlowML does not intrude on the training frameworks
					that are already out there, instead works with them to ease the storage,
					loading, and execution of models. Someone using RRFlowML will be able to train
					their model in a chosen framework in Python, save the model, and load and
					execute it in either Python or Rust. You can use RRFlowML within your database
					connection to store and execute trained ML models using{" "}
					<Link href="https://github.com/rrflow/connectome-development">
						Machine learning functions
					</Link>
					. Learn more about{" "}
					<Link href="https://github.com/rrflow/connectome-development">
						RRFlowML in the documentation
					</Link>
				</p>
			</div>
		</Article>
	);
}
