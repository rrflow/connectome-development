import { Alert } from "@mantine/core";
import type { UseQueryResult } from "@tanstack/react-query";
import { isRetryable } from "~/rrflow/session";
import { Icon, iconErrorCircle } from "../../../../rrflow/ui/index";
import { formatMoment } from "./format";

export interface ReadNoticeProps {
	/** A read retried with `busyRetry`. */
	query: UseQueryResult<unknown, Error>;
	/** When the reading on screen was taken, if one is on screen. */
	observedAt?: number;
}

/**
 * Why a lens is still waiting, or shows an older reading, in plain words:
 * the engine is busy with other requests, or the latest refresh failed.
 */
export function ReadNotice({ query, observedAt }: ReadNoticeProps) {
	const shown = observedAt ? ` Showing the reading from ${formatMoment(observedAt)}.` : "";
	if (query.failureCount > 0 && isRetryable(query.failureReason)) {
		return (
			<Alert
				color="yellow"
				variant="light"
				title="The engine is busy"
			>
				It is answering other requests, such as the similarity map's searches, so it could
				not put together a consistent report.{shown} Connectome keeps asking and updates
				this view as soon as it can.
			</Alert>
		);
	}
	if (query.isError && query.data !== undefined) {
		return (
			<Alert
				color="red"
				variant="light"
				title="The latest refresh failed"
				icon={<Icon path={iconErrorCircle} />}
			>
				{query.error instanceof Error ? query.error.message : "Unknown RRD error"}
				{shown}
			</Alert>
		);
	}
	return null;
}
