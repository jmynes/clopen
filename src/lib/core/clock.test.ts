import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setAppTimeZone, zonedToMs } from '$lib/date';
import type { OpenShift, TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import {
  adjustStart,
  clockIn,
  clockOut,
  clockStateOf,
  composeEntry,
  endBreak,
  isStale,
  resolveDiscard,
  resolveSave,
  startBreak,
} from './clock';
import { emptyRepo, type Repo } from './repo';

function fakeRepo() {
  let shift: OpenShift | null = null;
  const added: EntryInput[] = [];
  const repo: Repo = {
    ...emptyRepo,
    addEntry: async (input) => {
      added.push(input);
      return {
        id: 'x',
        createdAt: 0,
        updatedAt: null,
        date: input.date,
        hours: input.hours,
        breakHours: input.breakHours,
        startTime: input.startTime,
        endTime: input.endTime,
        note: input.note,
        entryKind: input.entryKind,
      } satisfies TimeEntry;
    },
    getOpenShift: async () => shift,
    saveOpenShift: async (row) => {
      shift = row;
    },
    clearOpenShift: async () => {
      shift = null;
    },
  };
  return { repo, added, shift: () => shift };
}

const T = (date: string, hhmm: string) => zonedToMs(date, hhmm);

beforeEach(() => setAppTimeZone('America/Chicago'));
afterEach(() => setAppTimeZone(null));

describe('accrue mode', () => {
  it('full cycle: in → break → back → out writes one entry with accrued break', async () => {
    const { repo, added, shift } = fakeRepo();
    await clockIn(repo, T('2026-06-10', '09:00'), 'accrue');
    expect(clockStateOf(shift())).toBe('working');
    await startBreak(repo, T('2026-06-10', '12:00'));
    expect(clockStateOf(shift())).toBe('on_break');
    await endBreak(repo, T('2026-06-10', '12:30'));
    expect(clockStateOf(shift())).toBe('working');
    await clockOut(repo, T('2026-06-10', '17:30'));
    expect(shift()).toBeNull();
    expect(added).toEqual([
      {
        date: '2026-06-10',
        hours: 8.5,
        breakHours: 0.5,
        startTime: '09:00',
        endTime: '17:30',
        note: null,
        entryKind: 'work',
      },
    ]);
  });

  it('clocking out while on break ends the shift at the break start', async () => {
    const { repo, added } = fakeRepo();
    await clockIn(repo, T('2026-06-10', '09:00'), 'accrue');
    await startBreak(repo, T('2026-06-10', '12:00'));
    await clockOut(repo, T('2026-06-10', '15:00'));
    expect(added[0]).toMatchObject({ endTime: '12:00', hours: 3 });
  });
});

describe('split mode', () => {
  it('each in→out span is its own entry; the break gap writes nothing', async () => {
    const { repo, added, shift } = fakeRepo();
    await clockIn(repo, T('2026-06-10', '09:00'), 'split');
    await startBreak(repo, T('2026-06-10', '12:00'));
    expect(added).toHaveLength(1); // segment written at break start
    expect(shift()?.startedAt).toBeNull();
    expect(clockStateOf(shift())).toBe('on_break');
    await endBreak(repo, T('2026-06-10', '12:30'));
    await clockOut(repo, T('2026-06-10', '17:30'));
    expect(added).toEqual([
      {
        date: '2026-06-10',
        hours: 3,
        breakHours: 0,
        startTime: '09:00',
        endTime: '12:00',
        note: null,
        entryKind: 'work',
      },
      {
        date: '2026-06-10',
        hours: 5,
        breakHours: 0,
        startTime: '12:30',
        endTime: '17:30',
        note: null,
        entryKind: 'work',
      },
    ]);
  });

  it('clock-out while on break writes nothing more', async () => {
    const { repo, added, shift } = fakeRepo();
    await clockIn(repo, T('2026-06-10', '09:00'), 'split');
    await startBreak(repo, T('2026-06-10', '12:00'));
    await clockOut(repo, T('2026-06-10', '13:00'));
    expect(added).toHaveLength(1);
    expect(shift()).toBeNull();
  });
});

describe('guards and edges', () => {
  it('punches require the right state', async () => {
    const { repo } = fakeRepo();
    expect((await startBreak(repo, 1)).ok).toBe(false);
    expect((await clockOut(repo, 1)).ok).toBe(false);
    expect((await endBreak(repo, 1)).ok).toBe(false);
    await clockIn(repo, T('2026-06-10', '09:00'), 'accrue');
    const dup = await clockIn(repo, T('2026-06-10', '10:00'), 'accrue');
    expect(dup).toMatchObject({ ok: false, status: 409 });
  });

  it('adjustStart moves the running segment start, only while working', async () => {
    const { repo, shift } = fakeRepo();
    expect((await adjustStart(repo, 1, 2)).ok).toBe(false);
    await clockIn(repo, T('2026-06-10', '09:14'), 'accrue');
    await adjustStart(repo, T('2026-06-10', '09:00'), T('2026-06-10', '10:00'));
    expect(shift()?.startedAt).toBe(T('2026-06-10', '09:00'));
    await startBreak(repo, T('2026-06-10', '12:00'));
    expect((await adjustStart(repo, T('2026-06-10', '08:00'), T('2026-06-10', '12:30'))).ok).toBe(false);
  });

  it('composeEntry spans midnight: date is the start date, hours keep real elapsed', () => {
    expect(composeEntry(T('2026-06-10', '23:00'), T('2026-06-11', '01:30'), 0)).toMatchObject({
      date: '2026-06-10',
      startTime: '23:00',
      endTime: '01:30',
      hours: 2.5,
    });
  });

  it('isStale: started before today in the app zone', async () => {
    const { repo, shift } = fakeRepo();
    await clockIn(repo, Date.now() - 26 * 3_600_000, 'accrue');
    expect(isStale(shift())).toBe(true);
    await resolveDiscard(repo);
    expect(shift()).toBeNull();
  });

  it('a shift started right now is not stale', async () => {
    const { repo, shift } = fakeRepo();
    await clockIn(repo, Date.now(), 'accrue');
    expect(isStale(shift())).toBe(false);
  });

  it('resolveSave clamps the end to the break start when on break', async () => {
    const { repo, added, shift } = fakeRepo();
    await clockIn(repo, T('2026-06-09', '09:00'), 'accrue');
    await startBreak(repo, T('2026-06-09', '12:00'));
    await resolveSave(repo, T('2026-06-09', '17:00'));
    expect(added[0]).toMatchObject({ endTime: '12:00' });
    expect(shift()).toBeNull();
  });
});
