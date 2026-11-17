import { scan } from "./scan.ts";

/**
 * The span an engine refusal at `offset` names: the token the offset falls
 * in, the next character when it falls between tokens, or the last
 * character when it falls at the end.
 */
export function refusalRange(source: string, offset: number): { from: number; to: number } {
	const at = Math.max(0, Math.min(offset, source.length));
	const token = scan(source).tokens.find((token) => token.from <= at && at < token.to);
	if (token) return { from: token.from, to: token.to };
	if (at < source.length) return { from: at, to: at + 1 };
	return { from: Math.max(0, source.length - 1), to: source.length };
}
