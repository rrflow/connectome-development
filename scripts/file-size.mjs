/**
 * The file-size rule, as a pure function so it can be tested.
 *
 * A source file may not exceed `limit` lines. Files that already did when the
 * rule began are listed in the baseline with the size they had; they may only
 * shrink, and an entry leaves the baseline in the change that brings its file
 * under the limit. So the largest files can only get smaller, and no new file
 * can start large.
 */

/**
 * @param {Record<string, number>} sizes line count of every checked file
 * @param {Record<string, number>} baseline the allowed size of each large file
 * @param {number} limit
 * @returns {string[]} one message per violation
 */
export function evaluate(sizes, baseline, limit) {
	const problems = [];
	for (const [path, lines] of Object.entries(sizes)) {
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
