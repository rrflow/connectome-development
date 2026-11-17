/**
 * The file-size rule, as pure functions so it can be tested.
 *
 * `docs/architecture/code-structure-and-conventions.md` sets the limits: a
 * TS or TSX file has at most 400 lines (C4); other source files follow R1, at
 * most 800 lines, and a test file at most 1,500. A file already over its limit
 * when the rule began is listed in the baseline with the size it had. It may
 * only shrink, and its entry leaves the baseline in the change that brings it
 * under the limit. So the largest files can only get smaller, and no new file
 * can start large.
 */

export const TS_LIMIT = 400;
export const SOURCE_LIMIT = 800;
export const TEST_LIMIT = 1500;

/** Whether a path is a test file. */
export function isTestFile(path) {
	return (
		/(^|\/)tests?\//.test(path) ||
		/(^|\/)tests\.rs$/.test(path) ||
		/_tests?\.rs$/.test(path) ||
		/\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
	);
}

/**
 * The limit that applies to a file, or null when no rule covers it.
 * @param {string} path repository-relative, with forward slashes
 */
export function limitFor(path) {
	if (isTestFile(path)) return TEST_LIMIT;
	if (/\.tsx?$/.test(path)) return TS_LIMIT;
	if (/\.rs$/.test(path)) return SOURCE_LIMIT;
	return null;
}

/**
 * @param {Record<string, number>} sizes line count of every checked file
 * @param {Record<string, number>} baseline the allowed size of each large file
 * @param {(path: string) => number | null} limitOf
 * @returns {string[]} one message per violation
 */
export function evaluate(sizes, baseline, limitOf = limitFor) {
	const problems = [];
	for (const [path, lines] of Object.entries(sizes)) {
		const limit = limitOf(path);
		if (limit === null) continue;
		const allowed = baseline[path];
		if (allowed === undefined) {
			if (lines > limit) {
				problems.push(
					`${path}: ${lines} lines is over the ${limit}-line limit; split it by what the code does`,
				);
			}
		} else if (lines > allowed) {
			problems.push(
				`${path}: grew from ${allowed} to ${lines} lines; a file over the limit may only shrink`,
			);
		} else if (lines <= limit) {
			problems.push(
				`${path}: is ${lines} lines, under the ${limit}-line limit; remove it from scripts/file-size-baseline.json`,
			);
		}
	}
	for (const path of Object.keys(baseline)) {
		if (!(path in sizes)) {
			problems.push(`${path}: is in scripts/file-size-baseline.json but no longer exists`);
		}
	}
	return problems;
}
