import { useQuery } from "@tanstack/react-query";
import { useSetting } from "~/hooks/config";
import { useFeatureFlags } from "~/shared/util/feature-flags";
import { InstancePlan } from "~/types";

type PricingConfigCTA =
	| {
			variant: "reversed" | "gradient";
			text: string;
			href: string;
	  }
	| {
			variant: "disabled";
			text: string;
	  };

export interface PricingConfigBase {
	id: string;
	name: string;
	dataset?: PricingConfigDataset;
	description: string;
	price: string | number | undefined;
	features: PricingConfigFeature[];
	coming_soon_features?: boolean[];
	featuresTitle: string;
	cta: PricingConfigCTA;
	plus?: string[];
	Connectome?: PricingConfigConnectome;
	computePrice?: PricingConfigComputePrice[];
	storagePrice?: PricingConfigStoragePrice[];
}

export interface PricingConfigComputePrice {
	node: string;
	type: string;
	cpu: string;
	memory: string;
	compute_price: string;
}

export interface PricingConfigStoragePrice {
	storage: string;
	price: string;
}

interface PricingConfigConnectome {
	plan: InstancePlan;
	defaultType?: string;
}

export interface PricingConfigDataset {
	id: string;
	version?: string;
	size?: string;
}

export interface PricingConfigFeature {
	name: string;
	comingSoon: true;
}

export interface PricingConfigCloud extends PricingConfigBase {
	resources: string[];
}

export interface PricingResult {
	cloud: PricingConfigCloud[];
	selfHosted: PricingConfigBase[];
	support: PricingConfigBase[];
}

export function useCloudPricingQuery() {
	const [flags] = useFeatureFlags();
	const [websiteSetting] = useSetting("cloud", "urlWebsiteBase");

	return useQuery({
		queryKey: ["cloud", "pricing"],
		queryFn: async () => {
			const isCustom = flags.website_base === "custom";
			const websiteBase = isCustom
				? websiteSetting
				: "https://github.com/rrflow/connectome-development";
			const response = await fetch(`${websiteBase}/api/cloud/pricing.json`);
			const plans: PricingResult = await response.json();

			return plans;
		},
	});
}
