import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RrdAuditRecordView, RrdSessionClient } from "~/rrflow/session";

/** The engine returns at most this many audit records per read. */
const AUDIT_PAGE = 512;
/** Full pages one refresh follows before it stops and says it is behind. */
const MAX_FOLLOWED_PAGES = 4;
/** Empty stretches of the journal one "older" read steps back over. */
const MAX_OLDER_WINDOWS = 8;
/** The activity log follows the live engine while it is open. */
export const AUDIT_REFRESH_MS = 10_000;

/**
 * The newest stretch of the audit log, oldest entry first. The engine only
 * reads forward from a position, so the first read starts one page before the
 * journal's newest position and each later read continues from `through`.
 */
export interface AuditTrail {
	/** The position the first read started after; older entries lie at or before it. */
	floor: number;
	/** The engine's `through_sequence` of the last read: where the next one resumes. */
	through: number;
	records: RrdAuditRecordView[];
	/** Whether the last refresh stopped before it reached the newest entry. */
	behind: boolean;
}

/** One stretch of older entries: those after `after`, up to and including `upTo`. */
export interface AuditWindow {
	after: number;
	upTo: number;
	records: RrdAuditRecordView[];
}

export function useAuditTrail(client: RrdSessionClient, sessionKey: string, enabled: boolean) {
	const queryClient = useQueryClient();
	const trailKey = ["rrd-audit-trail", sessionKey];

	const trail = useQuery({
		queryKey: trailKey,
		enabled,
		refetchInterval: AUDIT_REFRESH_MS,
		retry: false,
		queryFn: async (): Promise<AuditTrail> => {
			const known = queryClient.getQueryData<AuditTrail>(trailKey);
			let floor: number;
			let after: number;
			if (known) {
				floor = known.floor;
				after = known.through;
			} else {
				// Audit records are numbered by the engine's control journal, whose
				// newest position the storage report carries.
				const head = (await client.storage()).control_sequence;
				floor = Math.max(0, head - AUDIT_PAGE);
				after = floor;
			}
			const records = known ? [...known.records] : [];
			let behind = true;
			for (let page = 0; page < MAX_FOLLOWED_PAGES; page++) {
				const view = await client.audit(after, AUDIT_PAGE);
				records.push(...view.records);
				after = view.through_sequence;
				if (view.records.length < AUDIT_PAGE) {
					behind = false;
					break;
				}
			}
			return { floor, through: after, records, behind };
		},
	});

	const floor = trail.data?.floor;
	const older = useInfiniteQuery({
		queryKey: ["rrd-audit-older", sessionKey, floor],
		// Older entries are read only when asked for, one stretch at a time.
		enabled: false,
		retry: false,
		initialPageParam: floor ?? 0,
		queryFn: async ({ pageParam: upTo }): Promise<AuditWindow> => {
			let after = upTo;
			let records: RrdAuditRecordView[] = [];
			for (let step = 0; step < MAX_OLDER_WINDOWS && after > 0; step++) {
				after = Math.max(0, after - AUDIT_PAGE);
				const view = await client.audit(after, AUDIT_PAGE);
				records = view.records.filter((record) => record.sequence <= upTo);
				if (records.length > 0) break;
			}
			return { after, upTo, records };
		},
		getNextPageParam: (last) => (last.after > 0 ? last.after : undefined),
	});

	return { trail, older };
}
