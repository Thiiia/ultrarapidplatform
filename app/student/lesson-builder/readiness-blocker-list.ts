import type { EncounterIssue } from "@/lib/guided-authored-encounter";

export const READINESS_BLOCKER_PAGE_SIZE = 12;

export type ReadinessBlockerGroup = Readonly<{
  key: string;
  blocker: EncounterIssue;
  occurrences: number;
}>;

export type ReadinessBlockerPage = Readonly<{
  blockers: ReadinessBlockerGroup[];
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
}>;

export function groupReadinessBlockers(blockers: readonly EncounterIssue[]): ReadinessBlockerGroup[] {
  const groups = new Map<string, { blocker: EncounterIssue; occurrences: number }>();

  for (const blocker of blockers) {
    const key = JSON.stringify([blocker.encounterId ?? "lesson", blocker.code]);
    const group = groups.get(key);
    if (group) {
      group.occurrences += 1;
    } else {
      groups.set(key, { blocker, occurrences: 1 });
    }
  }

  return Array.from(groups, ([key, group]) => ({ key, ...group }));
}

export function paginateReadinessBlockers(
  groups: readonly ReadinessBlockerGroup[],
  requestedPage: number,
): ReadinessBlockerPage {
  const pageCount = Math.max(1, Math.ceil(groups.length / READINESS_BLOCKER_PAGE_SIZE));
  const pageNumber = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 0;
  const page = Math.max(0, Math.min(pageNumber, pageCount - 1));
  const offset = page * READINESS_BLOCKER_PAGE_SIZE;

  return {
    blockers: groups.slice(offset, offset + READINESS_BLOCKER_PAGE_SIZE),
    page,
    pageCount,
    start: groups.length === 0 ? 0 : offset + 1,
    end: Math.min(offset + READINESS_BLOCKER_PAGE_SIZE, groups.length),
    total: groups.length,
  };
}
