/**
 * Punch-clock state machine. The open shift is a single row (one shift at a
 * time); punches mutate it and clock-out composes normal ledger entries
 * through the Repo, so time_entries stays the only canonical record. All
 * instants are epoch ms; wall-clock fields are derived in the app zone only
 * at composition time (overnight spans rely on hoursBetween's midnight wrap
 * downstream).
 */
import { todayISO, zonedParts } from '$lib/date';
import type { OpenShift, Settings, TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import { type ClockBreakMode, workdaysJson } from '$lib/schemas/settings';
import { hoursBetween } from '$lib/timesheet';
import type { ActionOutcome } from './log';
import type { Repo } from './repo';

export type ClockState = 'idle' | 'working' | 'on_break';

export function clockStateOf(row: OpenShift | null): ClockState {
  if (!row) return 'idle';
  return row.breakStartedAt != null ? 'on_break' : 'working';
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const err = (status: number, error: string): ActionOutcome => ({ ok: false, status, data: { error } });
const ok = (): ActionOutcome => ({ ok: true, data: {} });

/**
 * Compose a ledger entry from an absolute span plus accrued break seconds.
 * `hours` is wall-clock (hoursBetween), matching how every other surface
 * re-derives clock entries — on a DST night the books follow the wall clock,
 * not elapsed atomic time. Break is clamped so net worked is never negative.
 */
export function composeEntry(startMs: number, endMs: number, breakSeconds: number): EntryInput {
  const start = zonedParts(startMs);
  const end = zonedParts(endMs);
  const hours = round2(hoursBetween(start.hhmm, end.hhmm));
  return {
    date: start.date,
    hours,
    breakHours: Math.min(round2(breakSeconds / 3600), hours),
    startTime: start.hhmm,
    endTime: end.hhmm,
    note: null,
    entryKind: 'work',
  };
}

export async function clockIn(repo: Repo, now: number, mode: ClockBreakMode): Promise<ActionOutcome> {
  if (await repo.getOpenShift()) return err(409, 'Already clocked in');
  await repo.saveOpenShift({ id: 'current', startedAt: now, breakStartedAt: null, breakSeconds: 0, breakMode: mode });
  return ok();
}

export async function startBreak(repo: Repo, now: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row || row.breakStartedAt != null || row.startedAt == null) return err(409, 'Not clocked in');
  if (now <= row.startedAt) return err(400, 'Break must start after clock-in');
  if (row.breakMode === 'split') {
    await repo.addEntry(composeEntry(row.startedAt, now, 0));
    await repo.saveOpenShift({ ...row, startedAt: null, breakStartedAt: now });
  } else {
    await repo.saveOpenShift({ ...row, breakStartedAt: now });
  }
  return ok();
}

export async function endBreak(repo: Repo, now: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row || row.breakStartedAt == null) return err(409, 'Not on a break');
  if (now <= row.breakStartedAt) return err(400, 'Break end must come after break start');
  if (row.breakMode === 'split') {
    await repo.saveOpenShift({ ...row, startedAt: now, breakStartedAt: null });
  } else {
    const breakSeconds = row.breakSeconds + Math.round((now - row.breakStartedAt) / 1000);
    await repo.saveOpenShift({ ...row, breakSeconds, breakStartedAt: null });
  }
  return ok();
}

/** Clocking out while on break ends the shift at the break's start. */
export async function clockOut(repo: Repo, now: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row) return err(409, 'Not clocked in');
  const end = row.breakStartedAt ?? now;
  if (row.startedAt != null) {
    if (end <= row.startedAt) return err(400, 'Clock-out must come after clock-in');
    await repo.addEntry(composeEntry(row.startedAt, end, row.breakSeconds));
  }
  // Split mode on break: the last segment was already written at break start.
  await repo.clearOpenShift();
  return ok();
}

export async function adjustStart(repo: Repo, startMs: number, now: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row || row.startedAt == null || row.breakStartedAt != null) return err(409, 'No running segment to adjust');
  if (startMs >= now) return err(400, 'Start must be in the past');
  await repo.saveOpenShift({ ...row, startedAt: startMs });
  return ok();
}

/** A shift is stale when it started before today (app zone). */
export function isStale(row: OpenShift | null): boolean {
  const startMs = row?.startedAt ?? row?.breakStartedAt;
  if (startMs == null) return false;
  return zonedParts(startMs).date < todayISO();
}

export async function resolveSave(repo: Repo, endMs: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row) return err(409, 'Nothing to resolve');
  const end = row.breakStartedAt != null ? Math.min(endMs, row.breakStartedAt) : endMs;
  if (row.startedAt != null) {
    if (end <= row.startedAt) return err(400, 'End must come after the shift started');
    await repo.addEntry(composeEntry(row.startedAt, end, row.breakSeconds));
  }
  await repo.clearOpenShift();
  return ok();
}

export async function resolveDiscard(repo: Repo): Promise<ActionOutcome> {
  if (!(await repo.getOpenShift())) return err(409, 'Nothing to resolve');
  await repo.clearOpenShift();
  return ok();
}

/** Clock page view-model, computed from layout data in +page.ts. */
export function computeClock(entries: TimeEntry[], row: Settings, openShift: OpenShift | null) {
  const today = todayISO();
  const todayEntries = entries.filter((e) => e.date === today);
  const workedToday = round2(todayEntries.reduce((s, e) => s + e.hours - e.breakHours, 0));
  // ISO weekday of today (1 = Mon … 7 = Sun) for the day-off hint.
  const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay() || 7;
  return {
    openShift,
    state: clockStateOf(openShift),
    stale: isStale(openShift),
    today,
    todayEntries,
    workedToday,
    timeFormat: row.timeFormat,
    breakMode: row.clockBreakMode,
    dailyHours: row.dailyHours,
    isTodayWorkday: workdaysJson.parse(JSON.parse(row.workdays)).includes(todayDow),
  };
}
