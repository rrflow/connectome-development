import { formatFileSize } from "~/shared/util/helpers";

/** Integer counters render with locale grouping. */
export function formatCount(value: number | null | undefined): string {
	return value === null || value === undefined ? "—" : value.toLocaleString();
}

export function formatSize(bytes: number | null | undefined): string {
	return bytes === null || bytes === undefined ? "—" : formatFileSize(bytes);
}

export function formatTime(unixMs: number | null | undefined): string {
	return unixMs ? new Date(unixMs).toLocaleString() : "—";
}

/** Digests render as a recognisable prefix; callers keep the full value in a title. */
export function shortDigest(digest: string | null | undefined, length = 12): string {
	return digest ? digest.slice(0, length) : "—";
}
