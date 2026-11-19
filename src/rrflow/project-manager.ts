import type { ProjectInstance } from "~/shared/types";

/**
 * The project manager's rules, without a screen: which projects it lists, what
 * each row may do, and what removing one says. Every row is decided from that
 * project's own instance and its own action in flight, so nothing one project
 * does can disable another project, the add form or the dialog.
 */

/** A project Connectome lists: its canonical folder and the name it shows. */
export interface ListedProject {
	project: string;
	name: string;
}

export interface ProjectRow extends ListedProject {
	instance: ProjectInstance;
}

export const projectName = (project: string) =>
	project.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? "Local project";

const notRunning = (project: string): ProjectInstance => ({
	project,
	state: "stopped",
	origin: "connectome",
	detail: "Not running.",
	revision: 0,
});

/**
 * Every project the manager shows, each once: the saved projects, the ones
 * added in this session that are not saved yet, then any other instance the
 * native registry tracks. A listed project always has a row, with its real
 * state; a project with no instance is not running.
 */
export function projectRows(
	saved: ListedProject[],
	added: ListedProject[],
	instances: Record<string, ProjectInstance>,
): ProjectRow[] {
	const rows = new Map<string, ProjectRow>();
	for (const { project, name } of [...saved, ...added]) {
		if (rows.has(project)) continue;
		rows.set(project, { project, name, instance: instances[project] ?? notRunning(project) });
	}
	for (const instance of Object.values(instances)) {
		if (rows.has(instance.project) || instance.state === "stopped") continue;
		rows.set(instance.project, {
			project: instance.project,
			name: projectName(instance.project),
			instance,
		});
	}
	return [...rows.values()];
}

/** What one row is doing because of a click on that row. */
export type RowAction = "starting" | "stopping" | "removing" | "opening";

export interface RowActivity {
	action?: RowAction;
	/** Why this row's last action failed; cleared when it acts again. */
	error?: string;
}

export type ActivityMap = Record<string, RowActivity>;

export function beginAction(map: ActivityMap, project: string, action: RowAction): ActivityMap {
	return { ...map, [project]: { action } };
}

/** Ends the row's action; an `error` stays on that row. */
export function endAction(map: ActivityMap, project: string, error?: string): ActivityMap {
	const { [project]: _ended, ...rest } = map;
	return error === undefined ? rest : { ...rest, [project]: { error } };
}

/**
 * The one start the person is waiting to be taken to: the project they asked
 * for last, and where they were in the app when they asked.
 */
export interface AwaitedStart {
	project: string;
	from: string;
}

/**
 * Whether a start that just finished opens its project. Only the start asked
 * for last does, and only while the person is still where they asked from.
 * Any other finished start stays in the list as running, with its own Open
 * project button, so several starts never move the person several times.
 */
export function opensWhenStarted(
	awaited: AwaitedStart | undefined,
	project: string,
	location: string,
): boolean {
	return awaited?.project === project && awaited.from === location;
}

export type Control = "hidden" | "enabled" | "disabled";

export interface RowControls {
	open: Control;
	stop: Control;
	start: Control;
	retry: Control;
	dismiss: Control;
	remove: Control;
	/** Why Remove cannot be used right now, in words for the row. */
	removeBlocked?: string;
	/** What Connectome cannot do for this instance yet. */
	limitation?: string;
}

const STARTED_ELSEWHERE =
	"Connectome did not start this instance, so it cannot stop it yet. Stop it where it was started.";

/**
 * What one row offers. It reads only that row: its instance, its own action in
 * flight, and whether its installation is waiting for review.
 */
export function rowControls(
	instance: ProjectInstance,
	activity: RowActivity | undefined,
	reviewing: boolean,
): RowControls {
	const busy = activity?.action !== undefined;
	const when = (shown: boolean): Control => (!shown ? "hidden" : busy ? "disabled" : "enabled");
	const ready = instance.state === "ready" && instance.engram !== undefined;
	const moving = instance.state === "starting" || instance.state === "stopping";
	return {
		open: when(ready),
		stop: when(ready && instance.origin === "connectome"),
		start: when(instance.state === "stopped" && !reviewing),
		retry: when(instance.state === "failed" && !reviewing),
		dismiss: when(instance.state === "failed"),
		remove: busy || moving ? "disabled" : "enabled",
		removeBlocked: moving
			? `Remove is available once this project has finished ${instance.state}.`
			: undefined,
		limitation: ready && instance.origin === "elsewhere" ? STARTED_ELSEWHERE : undefined,
	};
}

/**
 * Exactly what removing a project does, one sentence per effect: its engine,
 * Connectome's own records, and the project's files.
 */
export function removalStatement(row: ProjectRow, path: string): string[] {
	const { instance, name } = row;
	const running = instance.state === "ready" || instance.state === "starting";
	const engine = !running
		? "No engine is running for this project, so nothing is stopped."
		: instance.origin === "connectome"
			? "Its engine, which Connectome started, is stopped."
			: "Its instance was started outside Connectome and keeps running; Connectome cannot stop it yet.";
	return [
		engine,
		`"${name}" is removed from Connectome's project list and its saved connection is deleted.`,
		`Nothing in ${path} is deleted. The project's own files, its .rrflow folder and its data stay where they are, and adding the folder again brings the project back.`,
	];
}
