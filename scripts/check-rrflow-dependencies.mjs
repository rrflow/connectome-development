import { access, readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const upstream = /(?:@surrealdb\b|\bsurrealdb\b|\bsurrealist\b)/i;
const formerAliases = /^@rrflow\/(?:client|ui|cbor|wasm)(?:\/|$)/;

export function packageViolations(manifest) {
	const violations = [];
	for (const category of [
		"dependencies",
		"devDependencies",
		"optionalDependencies",
		"peerDependencies",
	]) {
		for (const [name, source] of Object.entries(manifest[category] ?? {})) {
			if (
				upstream.test(`${name} ${source}`) ||
				formerAliases.test(name) ||
				String(source).startsWith("npm:")
			) {
				violations.push(`${category}.${name}: ${source}`);
			}
		}
	}
	return violations;
}

export function moduleViolations(source) {
	const violations = [];
	const modules = /\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'`]([^"'`]+)["'`]/g;
	for (const match of source.matchAll(modules)) {
		if (upstream.test(match[1]) || formerAliases.test(match[1])) violations.push(match[1]);
	}
	return violations;
}

export function configViolations(source) {
	return source.match(/@rrflow\/(?:client|ui|cbor|wasm)(?:\/[^\s"']*)?/g) ?? [];
}

async function sourceFiles(root) {
	const files = [];
	for (const entry of await readdir(root, { withFileTypes: true })) {
		const path = join(root, entry.name);
		if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
		else if (
			entry.isFile() &&
			[".ts", ".tsx", ".js", ".mjs", ".css", ".scss"].includes(extname(path))
		)
			files.push(path);
	}
	return files;
}

export async function check(root) {
	const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
	const violations = packageViolations(manifest);
	const lock = await readFile(join(root, "pnpm-lock.yaml"), "utf8");
	if (upstream.test(lock))
		violations.push("pnpm-lock.yaml contains an upstream package or alias");
	for (const path of [...(await sourceFiles(join(root, "src"))), join(root, "vite.config.ts")]) {
		for (const module of moduleViolations(await readFile(path, "utf8"))) {
			violations.push(`${path}: ${module}`);
		}
	}
	for (const name of ["tsconfig.json", "vite.config.ts"]) {
		for (const alias of configViolations(await readFile(join(root, name), "utf8"))) {
			violations.push(`${name}: package-name alias ${alias}`);
		}
	}
	for (const name of ["rrflow-client.ts", "rrflowql-editor.ts"]) {
		const path = join(root, "src", "vendor", name);
		try {
			await access(path);
			violations.push(`${path}: retired vendor wrapper still exists`);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	if (violations.length)
		throw new Error(`RRFlow dependency ownership failed:\n${violations.join("\n")}`);
	console.log(
		"RRFlow dependency ownership: no Surreal packages, package-name aliases, vendor wrappers, or executable upstream imports.",
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await check(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
}
