/** Settings page view + save logic, shared by the routes and demo mode. */
import type { Settings } from '$lib/db/schema';
import { settingsInput } from '$lib/schemas/settings';
import type { ActionOutcome } from './log';
import { type Repo, toWorkSettings } from './repo';

export function computeSettingsPage(row: Settings) {
  return {
    settings: toWorkSettings(row),
    weekStartsOn: row.weekStartsOn,
    epoch: row.epoch,
    timeFormat: row.timeFormat,
    ledgerPeriod: row.ledgerPeriod,
    timeZone: row.timeZone,
    observeDst: row.observeDst,
    clockBreakMode: row.clockBreakMode,
    hideWeekendsEntries: row.hideWeekendsEntries,
    hideWeekendsGrid: row.hideWeekendsGrid,
    expandNotes: row.expandNotes,
    otMultiplierEnabled: row.otMultiplierEnabled,
    otMultiplier: row.otMultiplier,
  };
}

export async function saveSettingsAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const workdays = form.getAll('workdays').map((v) => Number(v));
  const parsed = settingsInput.safeParse({
    hourlyRate: form.get('hourlyRate'),
    dailyHours: form.get('dailyHours'),
    workdays,
    weekStartsOn: form.get('weekStartsOn'),
    epoch: form.get('epoch'),
    timeFormat: form.get('timeFormat'),
    ledgerPeriod: form.get('ledgerPeriod'),
    timeZone: form.get('timeZone'),
    observeDst: form.has('observeDst'),
    clockBreakMode: form.get('clockBreakMode'),
    hideWeekendsEntries: form.has('hideWeekendsEntries'),
    hideWeekendsGrid: form.has('hideWeekendsGrid'),
    expandNotes: form.has('expandNotes'),
    otMultiplierEnabled: form.has('otMultiplierEnabled'),
    otMultiplier: form.get('otMultiplier'),
  });
  if (!parsed.success) {
    return { ok: false, status: 400, data: { error: parsed.error.issues.map((i) => i.message).join('; ') } };
  }
  await repo.updateSettings(parsed.data);
  return { ok: true, data: { saved: true } };
}
