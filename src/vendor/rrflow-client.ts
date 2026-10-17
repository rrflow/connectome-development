/**
 * Temporary package boundary for the RRFlow client protocol.
 *
 * Application code imports only this RRFlow-named surface. The temporary
 * protocol package behind it can be replaced by the native RRFlow client without
 * touching feature code.
 */
export * from "surrealdb";
export { Surreal as RRFlow, surql as rrflowql } from "surrealdb";
