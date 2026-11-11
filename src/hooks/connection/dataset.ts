import { sleep } from "radash";
import { useState } from "react";
import { getRRFlow } from "~/connection/connection";
import { syncConnectionSchema } from "~/shared/util/connection/schema";
import { showInfo } from "~/shared/util/text/helpers";
import { getDatasetURL } from "~/shared/util/text/language";
import { useStable } from "../state/stable";

/**
 * Provides the necessary data and methods to apply datasets
 */
export function useDatasets() {
	const [isLoading, setIsLoading] = useState(false);

	const applyDataset = useStable(async (version: string) => {
		setIsLoading(true);

		try {
			const source = getDatasetURL(version);
			const response = await fetch(source);
			const dataset = await response.blob();

			await sleep(50);
			await getRRFlow().import(dataset);
			await syncConnectionSchema();

			showInfo({
				title: "Dataset loaded",
				subtitle: `The dataset has been applied`,
			});
		} finally {
			setIsLoading(false);
		}
	});

	return [applyDataset, isLoading] as const;
}
