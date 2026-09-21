/**
 * The Bonuses page's load and form-action logic, Repo-agnostic like
 * expenses.ts: the server route wraps failures in fail(), demo mode uses the
 * outcomes directly.
 */

import type { z } from 'zod';
import type { Bonus, Settings } from '$lib/db/schema';
import { bonusInput } from '$lib/schemas/bonus';
import type { ActionOutcome } from './log';
import type { Repo } from './repo';

export function computeBonuses(bonuses: Bonus[], row: Settings) {
  return {
    bonuses,
    epoch: row.epoch,
    weekStartsOn: row.weekStartsOn,
  };
}

/** A bonus's badge text: the typed label, else the category name. */
export function bonusLabelOf(label: string | null): string {
  return label?.trim() || 'Bonus';
}

function flattenError(parsed: z.ZodError): string {
  return parsed.issues.map((i) => i.message).join('; ');
}

function parseBonus(form: FormData) {
  return bonusInput.safeParse({
    date: form.get('date'),
    amount: form.get('amount'),
    label: form.get('label') ?? undefined,
    note: form.get('note') ?? undefined,
  });
}

export async function addBonusAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const parsed = parseBonus(form);
  if (!parsed.success) return { ok: false, status: 400, data: { bonusError: flattenError(parsed.error) } };
  await repo.addBonus(parsed.data);
  return { ok: true, data: { bonusAdded: true } };
}

export async function updateBonusAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const id = String(form.get('id') ?? '');
  if (!id) return { ok: false, status: 400, data: { bonusError: 'Missing bonus id' } };
  const parsed = parseBonus(form);
  if (!parsed.success) return { ok: false, status: 400, data: { bonusError: flattenError(parsed.error) } };
  await repo.updateBonus(id, parsed.data);
  return { ok: true, data: { bonusUpdated: true } };
}

export async function deleteBonusAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const id = String(form.get('id') ?? '');
  if (!id) return { ok: false, status: 400, data: { bonusError: 'Missing bonus id' } };
  await repo.deleteBonus(id);
  return { ok: true, data: { bonusDeleted: true } };
}

export type BonusActionName = 'add' | 'update' | 'delete';

/** Dispatch by SvelteKit action name ("?/add" → add). Demo mode's client router. */
export function runBonusAction(repo: Repo, action: BonusActionName, form: FormData): Promise<ActionOutcome> {
  switch (action) {
    case 'add':
      return addBonusAction(repo, form);
    case 'update':
      return updateBonusAction(repo, form);
    case 'delete':
      return deleteBonusAction(repo, form);
  }
}
