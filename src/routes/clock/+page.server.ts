import { fail } from '@sveltejs/kit';
import { adjustStart, clockIn, clockOut, endBreak, resolveDiscard, resolveSave, startBreak } from '$lib/core/clock';
import { effectiveZone, setAppTimeZone, zonedToMs } from '$lib/date';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import { parseTimeInput } from '$lib/timesheet';
import type { Actions } from './$types';

type Outcome = Awaited<ReturnType<typeof clockOut>>;
const unwrap = (out: Outcome) => (out.ok ? out.data : fail(out.status, out.data));
const demoFail = () => fail(400, { error: 'Demo mode handles this in the browser' });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Actions run before loads re-run, so pin the app zone here: entry
// composition derives its wall-clock fields from it.
async function settingsWithZone() {
  const s = await serverRepo.getSettings();
  setAppTimeZone(effectiveZone(s.timeZone, s.observeDst));
  return s;
}

/** "2026-06-10" + "5:30 PM" → epoch ms in the app zone, or null. */
function formMs(form: FormData, dateKey: string, timeKey: string): number | null {
  const date = form.get(dateKey);
  const time = form.get(timeKey);
  if (typeof date !== 'string' || !ISO_DATE.test(date) || typeof time !== 'string') return null;
  const hhmm = parseTimeInput(time);
  if (!hhmm) return null;
  return zonedToMs(date, hhmm);
}

export const actions: Actions = {
  in: async () => {
    if (isDemo) return demoFail();
    const s = await settingsWithZone();
    return unwrap(await clockIn(serverRepo, Date.now(), s.clockBreakMode));
  },
  breakStart: async () => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    return unwrap(await startBreak(serverRepo, Date.now()));
  },
  breakEnd: async () => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    return unwrap(await endBreak(serverRepo, Date.now()));
  },
  out: async () => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    return unwrap(await clockOut(serverRepo, Date.now()));
  },
  adjust: async ({ request }) => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    const ms = formMs(await request.formData(), 'date', 'time');
    if (ms == null) return fail(400, { error: 'Enter a time like 9:00 AM' });
    return unwrap(await adjustStart(serverRepo, ms, Date.now()));
  },
  resolveSave: async ({ request }) => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    const ms = formMs(await request.formData(), 'endDate', 'endTime');
    if (ms == null) return fail(400, { error: 'Enter when the shift ended' });
    return unwrap(await resolveSave(serverRepo, ms));
  },
  resolveDiscard: async () => {
    if (isDemo) return demoFail();
    // No composition here, but pin the zone like every sibling action so a
    // future side-effect can't silently run against a stale zone.
    await settingsWithZone();
    return unwrap(await resolveDiscard(serverRepo));
  },
};
