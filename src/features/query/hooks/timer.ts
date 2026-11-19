import { useState } from "react";
import { useVisibleInterval } from "~/hooks/state/interval";

/**
 * Schedule a refresh timer that will trigger a re-render every `interval` milliseconds
 * while the app is visible, and once more when it is shown again.
 *
 * @param interval The interval in milliseconds
 */
export function useRefreshTimer(interval: number) {
	const [_, setCounter] = useState(0);

	useVisibleInterval(() => setCounter((prev) => prev + 1), interval);
}
