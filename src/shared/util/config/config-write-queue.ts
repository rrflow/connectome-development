/** Serializes snapshots so an older save cannot finish after a newer one. */
export function createConfigWriteQueue<T>(snapshot: () => T, write: (value: T) => Promise<void>) {
	let previous: Promise<void> = Promise.resolve();
	return () => {
		const value = snapshot();
		// A failed write is reported to its caller, but must not prevent a later
		// retry from saving the current configuration.
		const next = previous.catch(() => undefined).then(() => write(value));
		previous = next;
		return next;
	};
}
