/**
 * The dashboard's savings-goal form actions, Repo-agnostic like expenses.ts:
 * the server route wraps failures in fail(), demo mode uses outcomes directly.
 */

import type { z } from 'zod';
import { savingsGoalInput } from '$lib/schemas/savings-goal';
import type { ActionOutcome } from './log';
import type { Repo } from './repo';

function flattenError(parsed: z.ZodError): string {
  return parsed.issues.map((i) => i.message).join('; ');
}

function parseGoal(form: FormData) {
  return savingsGoalInput.safeParse({
    name: form.get('name'),
    targetAmount: form.get('targetAmount'),
    startDate: form.get('startDate'),
    funding: form.get('funding'),
  });
}

export async function addSavingsGoalAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const parsed = parseGoal(form);
  if (!parsed.success) return { ok: false, status: 400, data: { goalError: flattenError(parsed.error) } };
  await repo.addSavingsGoal(parsed.data);
  return { ok: true, data: { goalAdded: true } };
}

export async function updateSavingsGoalAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const id = String(form.get('id') ?? '');
  if (!id) return { ok: false, status: 400, data: { goalError: 'Missing goal id' } };
  const parsed = parseGoal(form);
  if (!parsed.success) return { ok: false, status: 400, data: { goalError: flattenError(parsed.error) } };
  await repo.updateSavingsGoal(id, parsed.data);
  return { ok: true, data: { goalUpdated: true } };
}

export async function deleteSavingsGoalAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const id = String(form.get('id') ?? '');
  if (!id) return { ok: false, status: 400, data: { goalError: 'Missing goal id' } };
  await repo.deleteSavingsGoal(id);
  return { ok: true, data: { goalDeleted: true } };
}

export type SavingsGoalActionName = 'addGoal' | 'updateGoal' | 'deleteGoal';

/** Dispatch by SvelteKit action name ("?/addGoal" → addGoal). Demo mode's client router. */
export function runSavingsGoalAction(
  repo: Repo,
  action: SavingsGoalActionName,
  form: FormData,
): Promise<ActionOutcome> {
  switch (action) {
    case 'addGoal':
      return addSavingsGoalAction(repo, form);
    case 'updateGoal':
      return updateSavingsGoalAction(repo, form);
    case 'deleteGoal':
      return deleteSavingsGoalAction(repo, form);
  }
}
