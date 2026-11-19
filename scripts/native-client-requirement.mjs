/**
 * The measure behind `docs/native-client-requirement.md`.
 *
 * Two old branches set out to put Connectome entirely on RRFlow's own client
 * and neither finished. Their intent is a requirement on `main`, and this
 * module says, from the tree itself, how much of it is left. The functions
 * are pure; `check-native-client-requirement.mjs` reads the files.
 *
 * The recorded measure must equal the tree. A number that went up is refused.
 * A number that went down is also refused until the record is lowered in the
 * same change, so the record is never stale and never flatters.
 */

/** A capability is finished when the native client does it, or it has no meaning in RRFlow. */
const FINISHED = new Set(["native", "not applicable"]);

/** The module that re-exports the inherited client under RRFlow-facing names. */
const SEAM = /(?:^|\/)vendor\/rrflow-client$/;

const STRING_LITERAL = /(["'`])([^"'`\n]+)\1/g;

/** The declared dependencies whose name matches the inherited vendor's. */
export function inheritedDependencies(manifest, vendor) {
	return Object.keys({
		...manifest.dependencies,
		...manifest.devDependencies,
		...manifest.optionalDependencies,
	})
		.filter((name) => vendor.test(name))
		.sort();
}

/**
 * Whether `source` names an inherited dependency or the seam in a string:
 * an import, a re-export, a dynamic import or a bundler entry all count,
 * because each one keeps the inherited code in the build.
 */
export function reachesInherited(source, declared) {
	for (const [, , text] of source.matchAll(STRING_LITERAL)) {
		if (SEAM.test(text)) return true;
		for (const name of declared) {
			if (text === name || text.startsWith(`${name}/`) || text.startsWith(`${name}?`)) {
				return true;
			}
		}
	}
	return false;
}

/** Counts the visual checklist's items and how many are ticked. */
export function visualItems(checklist) {
	const open = checklist.match(/^- \[ \]/gm)?.length ?? 0;
	const shown = checklist.match(/^- \[[xX]\]/gm)?.length ?? 0;
	return { items: open + shown, shown };
}

/**
 * @param manifest   parsed `package.json`
 * @param vendor     the inherited vendor's name, as a pattern
 * @param sources    `{ path, content }` for every authored source file
 * @param parity     parsed `docs/inherited-capability-parity.json`
 * @param checklist  text of `tests/visual/PARITY.md`
 */
export function measure({ manifest, vendor, sources, parity, checklist }) {
	const declared = inheritedDependencies(manifest, vendor);
	const statuses = {};
	for (const capability of parity.capabilities) {
		statuses[capability.status] = (statuses[capability.status] ?? 0) + 1;
	}
	return {
		inheritedDependencies: declared.length,
		importers: sources
			.filter((file) => reachesInherited(file.content, declared))
			.map((file) => file.path)
			.sort(),
		parity: {
			capabilities: parity.capabilities.length,
			statuses: Object.fromEntries(Object.entries(statuses).sort()),
			unreadFiles: parity.filesNoAreaRead.length,
			missedCapabilities: parity.missedCapabilities.length,
		},
		visual: visualItems(checklist),
	};
}

function plural(count, one, many) {
	return `${count} ${count === 1 ? one : many}`;
}

/** Every way the record disagrees with the tree. Empty when the record is true. */
export function compare(recorded, measured) {
	const violations = [];
	if (measured.inheritedDependencies > recorded.inheritedDependencies) {
		violations.push(
			`package.json declares ${plural(measured.inheritedDependencies, "inherited dependency", "inherited dependencies")}; the record allows ${recorded.inheritedDependencies}, and the number may only go down.`,
		);
	} else if (measured.inheritedDependencies < recorded.inheritedDependencies) {
		violations.push(
			`package.json now declares ${plural(measured.inheritedDependencies, "inherited dependency", "inherited dependencies")}; lower the record from ${recorded.inheritedDependencies} in this change.`,
		);
	}
	const known = new Set(recorded.importers);
	const present = new Set(measured.importers);
	for (const path of measured.importers) {
		if (!known.has(path)) {
			violations.push(
				`${path} reaches the inherited client and is not in the record; nothing new may be built on it.`,
			);
		}
	}
	for (const path of recorded.importers) {
		if (!present.has(path)) {
			violations.push(
				`${path} no longer reaches the inherited client; remove it from the record in this change.`,
			);
		}
	}
	if (JSON.stringify(recorded.parity) !== JSON.stringify(measured.parity)) {
		violations.push(
			`the capability record changed: the requirement records ${JSON.stringify(recorded.parity)} and docs/inherited-capability-parity.json holds ${JSON.stringify(measured.parity)}; make them agree in this change.`,
		);
	}
	if (JSON.stringify(recorded.visual) !== JSON.stringify(measured.visual)) {
		violations.push(
			`the visual checklist changed: the requirement records ${JSON.stringify(recorded.visual)} and tests/visual/PARITY.md holds ${JSON.stringify(measured.visual)}; make them agree in this change.`,
		);
	}
	return violations;
}

/** What is still owed, in words. Empty only when the requirement is met. */
export function remaining(measured) {
	const left = [];
	if (measured.inheritedDependencies > 0) {
		left.push(
			`${plural(measured.inheritedDependencies, "inherited dependency is", "inherited dependencies are")} still declared`,
		);
	}
	if (measured.importers.length > 0) {
		left.push(
			`${plural(measured.importers.length, "file still reaches", "files still reach")} the inherited client`,
		);
	}
	const unfinished = Object.entries(measured.parity.statuses)
		.filter(([status]) => !FINISHED.has(status))
		.reduce((sum, [, count]) => sum + count, 0);
	if (unfinished > 0) {
		left.push(
			`${unfinished} of ${measured.parity.capabilities} inherited capabilities not yet native`,
		);
	}
	if (measured.parity.unreadFiles > 0) {
		left.push(
			`${plural(measured.parity.unreadFiles, "inherited file has", "inherited files have")} not been read for capabilities`,
		);
	}
	if (measured.parity.missedCapabilities > 0) {
		left.push(
			`${plural(measured.parity.missedCapabilities, "missed capability has", "missed capabilities have")} no row`,
		);
	}
	const unshown = measured.visual.items - measured.visual.shown;
	if (unshown > 0) {
		left.push(
			`${unshown} of ${measured.visual.items} visual items not yet shown equal or better`,
		);
	}
	return left;
}
