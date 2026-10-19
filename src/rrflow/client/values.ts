/**
 * Connectome presentation values. The native SDK owns the RRD wire contract;
 * these objects never encode a transport or create engine state.
 */
export class Table {
	constructor(readonly name: string) {
		if (!name) throw new TypeError("A record kind is required");
	}
	toString() {
		return this.name;
	}
	toJSON() {
		return this.name;
	}
}

/** A public RRD data reference, with a table projection for table/graph lenses. */
export class RecordId {
	readonly kind: string;
	readonly id: string;
	readonly table: Table;
	constructor(kind: string | Table, id: unknown) {
		this.kind = kind instanceof Table ? kind.name : kind;
		if (typeof id !== "string" || !id) {
			throw new TypeError("RRFlow record references require a non-empty string identity");
		}
		this.id = id;
		this.table = new Table(this.kind);
	}
	toString() {
		return `${this.kind}:${this.id}`;
	}
	toJSON() {
		return { kind: this.kind, id: this.id };
	}
	equals(other: unknown) {
		return other instanceof RecordId && other.kind === this.kind && other.id === this.id;
	}
}

/** Reads the engine's human-readable `kind:id` reference, not executable QL. */
export class StringRecordId extends RecordId {
	constructor(reference: string) {
		const separator = reference.indexOf(":");
		if (separator <= 0 || separator === reference.length - 1) {
			throw new TypeError("A record reference must contain its kind and identity");
		}
		super(reference.slice(0, separator), reference.slice(separator + 1));
	}
}

export class Decimal {
	readonly value: string;
	constructor(value: string | number) {
		this.value = String(value);
		if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(this.value)) {
			throw new TypeError("Invalid decimal value");
		}
	}
	toString() {
		return this.value;
	}
	toJSON() {
		return this.value;
	}
}

const DURATION_UNITS: Record<string, bigint> = {
	ns: 1n,
	us: 1_000n,
	µs: 1_000n,
	ms: 1_000_000n,
	s: 1_000_000_000n,
	m: 60_000_000_000n,
	h: 3_600_000_000_000n,
	d: 86_400_000_000_000n,
	w: 604_800_000_000_000n,
};

/** A local elapsed-time display; RRD session/operation limits stay native. */
export class Duration {
	readonly nanoseconds: bigint;
	constructor(value: string | number | bigint) {
		if (typeof value === "bigint") this.nanoseconds = value;
		else if (typeof value === "number") {
			if (!Number.isSafeInteger(value))
				throw new TypeError("Duration must be exact nanoseconds");
			this.nanoseconds = BigInt(value);
		} else {
			const matches = [...value.matchAll(/(\d+)(ns|us|µs|ms|s|m|h|d|w)/g)];
			if (!matches.length || matches.map((part) => part[0]).join("") !== value) {
				throw new TypeError("Invalid duration; expected explicit units");
			}
			this.nanoseconds = matches.reduce(
				(sum, part) => sum + BigInt(part[1]) * DURATION_UNITS[part[2]],
				0n,
			);
		}
		if (this.nanoseconds < 0n) throw new RangeError("Duration must be non-negative");
	}
	get seconds() {
		return Number(this.nanoseconds) / 1_000_000_000;
	}
	toString() {
		return `${this.nanoseconds}ns`;
	}
	toJSON() {
		return { nanoseconds: this.nanoseconds.toString() };
	}
}

export class Uuid {
	readonly value: string;
	constructor(value: string) {
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
			throw new TypeError("Invalid UUID");
		}
		this.value = value.toLowerCase();
	}
	toString() {
		return this.value;
	}
	toJSON() {
		return this.value;
	}
}

export class DateTime {
	readonly #date: Date;
	constructor(value: string | number | Date) {
		this.#date = new Date(value);
		if (!Number.isFinite(this.#date.getTime())) throw new TypeError("Invalid datetime");
	}
	toDate() {
		return new Date(this.#date);
	}
	toString() {
		return this.#date.toISOString();
	}
	toJSON() {
		return this.toString();
	}
}

/** An inert file reference for display; it grants no filesystem access. */
export class FileRef {
	constructor(readonly uri: string) {}
	toString() {
		return this.uri;
	}
	toJSON() {
		return this.uri;
	}
}

export type Position = [number, number] | [number, number, number];
abstract class Geometry {
	abstract toJSON(): { type: string; coordinates?: unknown; geometries?: unknown[] };
	toString() {
		return JSON.stringify(this.toJSON());
	}
}
export class GeometryPoint extends Geometry {
	constructor(readonly point: Position) {
		super();
	}
	toJSON() {
		return { type: "Point", coordinates: this.point };
	}
}
export class GeometryLine extends Geometry {
	constructor(readonly points: Position[]) {
		super();
	}
	toJSON() {
		return { type: "LineString", coordinates: this.points };
	}
}
export class GeometryPolygon extends Geometry {
	constructor(readonly coordinates: Position[][]) {
		super();
	}
	toJSON() {
		return { type: "Polygon", coordinates: this.coordinates };
	}
}
export class GeometryMultiPoint extends Geometry {
	constructor(readonly coordinates: Position[]) {
		super();
	}
	toJSON() {
		return { type: "MultiPoint", coordinates: this.coordinates };
	}
}
export class GeometryMultiLine extends Geometry {
	constructor(readonly coordinates: Position[][]) {
		super();
	}
	toJSON() {
		return { type: "MultiLineString", coordinates: this.coordinates };
	}
}
export class GeometryMultiPolygon extends Geometry {
	constructor(readonly coordinates: Position[][][]) {
		super();
	}
	toJSON() {
		return { type: "MultiPolygon", coordinates: this.coordinates };
	}
}
export class GeometryCollection extends Geometry {
	constructor(readonly geometries: Geometry[]) {
		super();
	}
	toJSON() {
		return {
			type: "GeometryCollection",
			geometries: this.geometries.map((item) => item.toJSON()),
		};
	}
}

/** Quotes a QL identifier for user-authored text; parsing remains engine-owned. */
export function escapeIdent(value: string): string {
	if (!value || Array.from(value).some((character) => character.charCodeAt(0) < 32)) {
		throw new TypeError("Invalid identifier");
	}
	return `"${value.replaceAll('"', '""')}"`;
}

export function equals(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
	if (left instanceof DateTime && right instanceof DateTime)
		return left.toString() === right.toString();
	if (left instanceof RecordId) return left.equals(right);
	if (left instanceof Uuid && right instanceof Uuid) return left.value === right.value;
	if (left instanceof Duration && right instanceof Duration)
		return left.nanoseconds === right.nanoseconds;
	if (Array.isArray(left) && Array.isArray(right)) {
		return (
			left.length === right.length &&
			left.every((value, index) => equals(value, right[index]))
		);
	}
	if (left && right && typeof left === "object" && typeof right === "object") {
		const a = Object.entries(left);
		const b = Object.entries(right);
		return (
			a.length === b.length &&
			a.every(
				([key, value]) =>
					Object.hasOwn(right, key) &&
					equals(value, (right as Record<string, unknown>)[key]),
			)
		);
	}
	return false;
}

export interface RRFlowQueryIntent {
	readonly text: string;
	readonly bindings: Readonly<Record<string, unknown>>;
}

/** Captures bindings without injecting values into executable query text. */
export function rrflowql(parts: TemplateStringsArray, ...values: unknown[]): RRFlowQueryIntent {
	const bindings: Record<string, unknown> = {};
	let text = parts[0];
	for (const [index, value] of values.entries()) {
		const key = `connectome_${index}`;
		bindings[key] = value;
		text += `$${key}${parts[index + 1]}`;
	}
	return { text, bindings };
}
