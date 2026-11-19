/** The two Serving settings that pace the serving console. */
export interface OutputLimits {
	/** Lines taken at once before the console starts dropping output. */
	outputBurstLines: number;
	/** Milliseconds for one line of that allowance to come back. */
	outputRefillMs: number;
}

/**
 * How much of an engine's output the serving console takes at once. A burst of
 * up to `outputBurstLines` lines is taken; the allowance then comes back one
 * line every `outputRefillMs`, and a line that arrives with none left is
 * dropped. It is counted when a line arrives, so nothing runs on a timer.
 *
 * `limits` is read for every line, so the Serving settings "Console burst
 * (lines)" and "Console refill (milliseconds)" apply as soon as they change.
 * Their defaults are in `createBaseSettings`. How many lines the console keeps
 * is the separate setting "Console history size".
 */
export function outputAllowance(limits: () => OutputLimits, now: () => number = Date.now) {
	let used = 0;
	let refilledAt = now();
	return function take(): boolean {
		const { outputBurstLines, outputRefillMs } = limits();
		const refilled = Math.floor((now() - refilledAt) / outputRefillMs);
		if (refilled > 0) {
			used = Math.max(0, used - refilled);
			refilledAt += refilled * outputRefillMs;
		}
		if (used >= outputBurstLines) return false;
		used++;
		return true;
	};
}
