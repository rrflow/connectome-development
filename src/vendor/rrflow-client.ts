/**
 * The inherited query client, re-exported under RRFlow-facing names.
 *
 * This is SurrealDB's JavaScript client (`surrealdb`), not RRFlow's: the
 * `RRFlow` class exported here is `Surreal`, and `rrflowql` is its `surql`
 * template tag. Feature code that imports this module is driving the inherited
 * engine, and its results are not evidence about RRD. The module exists so that
 * the inherited views compile while they are replaced, view by view, with
 * surfaces on `@rrflow/rrd-client` (sprint 009, Slice D); it is deleted with
 * the last of them, together with the `surrealdb` and `@surrealdb/wasm`
 * dependencies. Do not add new importers.
 */
export * from "surrealdb";
export { Surreal as RRFlow, surql as rrflowql } from "surrealdb";
