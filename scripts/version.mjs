import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

/**
 * Connectome's version contract.
 *
 * `package.json` owns the version and the maturity channel:
 *
 *   "version": "0.0.5",
 *   "connectome": { "channel": "alpha" }
 *
 * Every other place that states them is derived from it and checked here:
 * `src-tauri/Cargo.toml` and the `connectome` entry of `src-tauri/Cargo.lock`
 * (Cargo cannot read `package.json`), `src-tauri/tauri.conf.json` (which reads
 * `package.json` by reference), and the Vite defines `import.meta.env.VERSION`
 * and `import.meta.env.CHANNEL`, which `vite.config.ts` reads at build time.
 *
 * The version is a plain semver core without a pre-release suffix. The
 * channel is carried beside it instead of inside it because the packagers
 * disagree about suffixes: Tauri's NSIS bundler drops them, its MSI bundler
 * accepts only numeric ones, and its RPM bundler passes the string through to
 * an RPM header whose Version field forbids `-`. The channel is what the
 * product displays ("0.0.5 alpha"); the version is what the packages carry.
 *
 *   node scripts/version.mjs --check          fail unless every copy agrees
 *   node scripts/version.mjs 0.0.6 [channel]  set the version (and channel)
 *                                             everywhere, then re-check
 */

const CHANNELS = new Set(["alpha", "beta", "rc", "stable"]);
const SEMVER_CORE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const manifestPath = "package.json";
const cargoPath = "src-tauri/Cargo.toml";
const lockPath = "src-tauri/Cargo.lock";

async function readManifest() {
	return JSON.parse(await readFile(manifestPath, "utf8"));
}

function cargoVersion(text) {
	return text.match(/^\[package\][^[]*?^version = "([^"]+)"/ms)?.[1];
}

function lockVersion(text) {
	const block = text
		.split("[[package]]")
		.find((candidate) => /^name = "connectome"$/m.test(candidate));
	return block?.match(/^version = "([^"]+)"$/m)?.[1];
}

async function check() {
	const manifest = await readManifest();
	const version = manifest.version;
	const channel = manifest.connectome?.channel;
	const failures = [];
	if (!SEMVER_CORE.test(version ?? "")) {
		failures.push(
			`package.json version "${version}" is not a plain semver core (major.minor.patch)`,
		);
	}
	if (!CHANNELS.has(channel)) {
		failures.push(
			`package.json connectome.channel "${channel}" is not one of ${[...CHANNELS].join(", ")}`,
		);
	}
	const cargo = cargoVersion(await readFile(cargoPath, "utf8"));
	if (cargo !== version) {
		failures.push(`${cargoPath} version "${cargo}" differs from package.json "${version}"`);
	}
	const lock = lockVersion(await readFile(lockPath, "utf8"));
	if (lock !== version) {
		failures.push(
			`${lockPath} connectome version "${lock}" differs from package.json "${version}"`,
		);
	}
	if (failures.length > 0) {
		console.error("Version contract violated:");
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exitCode = 1;
		return false;
	}
	console.log(`Version contract holds: ${version} ${channel}.`);
	return true;
}

async function set(version, channel) {
	if (!SEMVER_CORE.test(version)) {
		throw new Error(`"${version}" is not a plain semver core (major.minor.patch)`);
	}
	if (channel !== undefined && !CHANNELS.has(channel)) {
		throw new Error(`"${channel}" is not one of ${[...CHANNELS].join(", ")}`);
	}
	const manifestText = await readFile(manifestPath, "utf8");
	const manifest = JSON.parse(manifestText);
	let next = manifestText.replace(/^(\t"version": ")[^"]+(",)$/m, `$1${version}$2`);
	if (channel !== undefined) {
		next = next.replace(/^(\t\t"channel": ")[^"]+(")$/m, `$1${channel}$2`);
	}
	if (JSON.parse(next).version !== version) {
		throw new Error("package.json version line was not found in its expected form");
	}
	await writeFile(manifestPath, next);

	const cargo = await readFile(cargoPath, "utf8");
	const current = cargoVersion(cargo);
	await writeFile(cargoPath, cargo.replace(`version = "${current}"`, `version = "${version}"`));

	const lock = await readFile(lockPath, "utf8");
	await writeFile(
		lockPath,
		lock.replace(
			/(\[\[package\]\]\nname = "connectome"\nversion = ")[^"]+(")/,
			`$1${version}$2`,
		),
	);
	console.log(
		`Set ${version}${channel ? ` ${channel}` : ""} in package.json, Cargo.toml and Cargo.lock (was ${manifest.version} ${manifest.connectome?.channel}).`,
	);
}

const [first, second] = process.argv.slice(2);
if (first === undefined || first === "--check") {
	await check();
} else {
	await set(first, second);
	await check();
}
