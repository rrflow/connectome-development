import { useForceUpdate } from "@mantine/hooks";
import dayjs from "dayjs";
import { useVisibleInterval } from "~/hooks/state/interval";

/** The smallest step relative wording has ("a minute ago"); a unit, not a setting. */
const MINUTE_MS = 60_000;

export interface RelativeTimeProps {
	value: number;
}

export function RelativeTime({ value }: RelativeTimeProps) {
	const update = useForceUpdate();

	// The wording changes by the minute; a hidden window is not re-rendered.
	useVisibleInterval(update, MINUTE_MS);

	return dayjs(value).fromNow();
}
