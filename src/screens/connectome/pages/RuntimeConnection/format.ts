/** Integer counters render with locale grouping. */
export function formatCount(value: number | null | undefined): string {
	return value === null || value === undefined ? "—" : value.toLocaleString();
}

const BINARY_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"];

/**
 * Binary units, matching how rrflowKV sizes its cache, memtable, and WAL
 * thresholds (a 64 MiB WAL ceiling must not render as 67.11 MB).
 */
export function formatSize(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined) return "—";
	let value = bytes;
	let unit = 0;
	while (Math.abs(value) >= 1024 && unit < BINARY_UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}
	if (unit === 0) return `${value} B`;
	const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
	return `${value.toFixed(digits)} ${BINARY_UNITS[unit]}`;
}

export function formatTime(unixMs: number | null | undefined): string {
	return unixMs ? new Date(unixMs).toLocaleString() : "—";
}

/** Digests render as a recognisable prefix; callers keep the full value in a title. */
export function shortDigest(digest: string | null | undefined, length = 12): string {
	return digest ? digest.slice(0, length) : "—";
}
