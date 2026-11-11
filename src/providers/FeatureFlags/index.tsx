import { FeatureFlagProvider } from "@theopensource-company/feature-flags/react";
import { type PropsWithChildren, useEffect } from "react";
import { featureFlags } from "~/shared/util/config/feature-flags";
import { createLock } from "~/shared/util/platform/lock";
import { useConfigStore } from "~/shell/stores/config";

const { lock: featureFlagsLock, Resolve } = createLock();

export { featureFlagsLock };

export function FeatureFlagsProvider({ children }: PropsWithChildren) {
	const fromConfig = useConfigStore((s) => s.featureFlags);
	const setFeatureFlag = useConfigStore((s) => s.setFeatureFlag);

	useEffect(() => {
		featureFlags.subscribe(setFeatureFlag);

		return () => {
			featureFlags.unsubscribe(setFeatureFlag);
		};
	}, [setFeatureFlag]);

	return (
		<FeatureFlagProvider
			featureFlags={featureFlags}
			hydratedOverrides={(flag) => fromConfig[flag]}
		>
			<Resolve />
			{children}
		</FeatureFlagProvider>
	);
}
