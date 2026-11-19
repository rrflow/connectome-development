/*
 * What a cloud source's address may be. A source is typed by a person, kept in
 * the configuration, and later opened in a browser or fetched, so it is
 * checked when it is added and again each time it is used: a saved
 * configuration may hold an address from before this rule.
 *
 * Carried from the workbench's earlier sources panel (commit `fa8d769c`),
 * whose rule was lost when the panel was restructured.
 */

/** The address as a URL, or an error that says what is wrong with it. */
export function sourceUrl(value: string): URL {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		throw new Error("Provide a valid HTTPS source URL.");
	}
	if (url.protocol !== "https:" || url.username || url.password) {
		throw new Error("Source URLs must use HTTPS and cannot contain credentials.");
	}
	return url;
}

/** The plain-text export of a Google Docs document, which only Google Docs serves. */
export function googleDocsRelayUrl(source: URL): string {
	const match = source.pathname.match(/^\/document\/d\/([^/]+)(?:\/|$)/);
	if (source.hostname !== "docs.google.com" || !match) {
		throw new Error("Provide a Google Docs document URL.");
	}
	return `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
}

export type CheckedSource = { url: string; relayUrl?: string } | { error: string };

/** A typed address, checked; `relay` asks for the Google Docs export as well. */
export function checkedSource(value: string, relay: boolean): CheckedSource {
	try {
		const url = sourceUrl(value);
		return { url: url.href, relayUrl: relay ? googleDocsRelayUrl(url) : undefined };
	} catch (cause) {
		return { error: (cause as Error).message };
	}
}

/** The address a saved source is read or opened at, checked again. */
export function usableSourceUrl(source: { url: string; relayUrl?: string }): string {
	return sourceUrl(source.relayUrl ?? source.url).href;
}

/** Opens a saved source in the browser. Returns why it was refused, or null. */
export function openSource(source: { url: string; relayUrl?: string }): string | null {
	try {
		window.open(usableSourceUrl(source), "_blank", "noopener");
		return null;
	} catch (cause) {
		return (cause as Error).message;
	}
}
