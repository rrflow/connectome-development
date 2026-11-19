import { useEffect } from "react";
import { visibleInterval } from "~/shared/util/platform/visibility";
import { useStable } from "./stable";

/**
 * Repeats `callback` every `intervalMs` while the app is visible and `enabled`.
 * Nothing runs behind a hidden window; `callback` runs at once when the window
 * is shown again.
 */
export function useVisibleInterval(callback: () => void, intervalMs: number, enabled = true) {
	const stable = useStable(callback);

	useEffect(() => {
		if (enabled) return visibleInterval(stable, intervalMs);
	}, [enabled, intervalMs]);
}
