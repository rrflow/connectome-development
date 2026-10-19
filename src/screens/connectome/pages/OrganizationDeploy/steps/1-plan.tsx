import { Box, Button, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { useLayoutEffect } from "react";
import { useSearchParams } from "wouter";
import { isInstancePlan } from "~/cloud/helpers";
import { PricingConfigCloud, useCloudPricingQuery } from "~/cloud/queries/pricing";
import { useHasCloudFeature } from "~/hooks/cloud";
import { useStable } from "~/hooks/stable";
import { PricingCard } from "~/screens/connectome/components/PricingCard";
import { Icon, iconArrowUpRight } from "../../../../../rrflow/ui/index";
import classes from "../style.module.scss";
import { StepProps } from "../types";

export function PlanStep({ organisation, instances, setDetails, setStep }: StepProps) {
	const [search] = useSearchParams();

	const freeCount = instances.filter((instance) => instance.type.price_hour === 0).length;
	const showFree = freeCount < organisation.max_free_instances;
	const showEnterprise = useHasCloudFeature("distributed_storage");
	const pricingQuery = useCloudPricingQuery();

	const onClickPlan = useStable((config: PricingConfigCloud) => {
		setStep(1);
		setDetails((details) => {
			details.plan = config.Connectome?.plan ?? "free";
			details.startingData = {
				type: details.plan === "free" ? "dataset" : "none",
			};
			details.computeType = config.Connectome?.defaultType ?? "";
		});
	});

	useLayoutEffect(() => {
		const initialPlan = search.get("plan");

		if (initialPlan && isInstancePlan(initialPlan)) {
			if (initialPlan === "free" && !showFree) {
				return;
			}

			const config = pricingQuery.data?.cloud?.find((plan) => plan.id === initialPlan);

			if (config) {
				onClickPlan(config);
			}
		}
	}, [showFree, search, pricingQuery.data]);

	return (
		<>
			<SimpleGrid
				cols={{ base: 1, sm: 2, lg: 3 }}
				spacing="xl"
				className={classes.content}
			>
				{showFree &&
					(pricingQuery.isSuccess ? (
						<PricingCard
							state="available"
							ctaText="Configure instance"
							onClick={(config) => onClickPlan(config as PricingConfigCloud)}
							config={pricingQuery.data.cloud?.find(
								(plan) => plan.Connectome?.plan === "free",
							)}
						/>
					) : (
						<Skeleton h={650} />
					))}

				{pricingQuery.isSuccess ? (
					<PricingCard
						state="available"
						ctaText="Configure instance"
						onClick={(config) => onClickPlan(config as PricingConfigCloud)}
						config={pricingQuery.data.cloud?.find(
							(plan) => plan.Connectome?.plan === "start",
						)}
					/>
				) : (
					<Skeleton h={650} />
				)}

				{pricingQuery.isSuccess ? (
					<PricingCard
						state="future"
						ctaText="Configure instance"
						onClick={(config) => onClickPlan(config as PricingConfigCloud)}
						config={pricingQuery.data.cloud?.find(
							(plan) => plan.Connectome?.plan === "scale",
						)}
					/>
				) : (
					<Skeleton h={650} />
				)}

				{pricingQuery.isSuccess ? (
					<PricingCard
						state={showEnterprise ? "available" : "contact"}
						ctaText="Configure instance"
						onClick={(config) => onClickPlan(config as PricingConfigCloud)}
						config={
							{
								...pricingQuery.data.cloud?.find(
									(plan) => plan.Connectome?.plan === "enterprise",
								),
								price: showEnterprise
									? "Available"
									: pricingQuery.data.cloud?.find(
											(plan) => plan.Connectome?.plan === "enterprise",
										)?.price,
							} as PricingConfigCloud
						}
					/>
				) : (
					<Skeleton h={650} />
				)}
			</SimpleGrid>

			<Box mt="sm">
				<Text c="obsidian">* Coming soon</Text>
			</Box>

			<Stack
				align="center"
				mt={36}
			>
				<Text>Looking for more pricing options and information?</Text>
				<a
					href="https://github.com/EonsofStupid/connectome"
					target="_blank"
					rel="noreferrer"
				>
					<Button
						size="xs"
						color="obsidian"
						variant="light"
						rightSection={<Icon path={iconArrowUpRight} />}
					>
						View pricing information
					</Button>
				</a>
			</Stack>
		</>
	);
}
