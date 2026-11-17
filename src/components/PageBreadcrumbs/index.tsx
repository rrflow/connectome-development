import { BoxProps, Breadcrumbs } from "@mantine/core";
import { AppLink } from "~/components/AppLink";
import classes from "./style.module.scss";

export interface PageBreadcrumbsProps extends BoxProps {
	items: { label: string; href?: string }[];
}

export function PageBreadcrumbs({ items, ...other }: PageBreadcrumbsProps) {
	return (
		<Breadcrumbs {...other}>
			{items.map((item, index) =>
				item.href ? (
					<AppLink
						key={index}
						href={item.href}
						className={classes.link}
					>
						{item.label}
					</AppLink>
				) : (
					<span
						key={index}
						className={classes.link}
					>
						{item.label}
					</span>
				),
			)}
		</Breadcrumbs>
	);
}
