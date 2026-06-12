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
    allocation: form.get('allocation') ?? undefined,
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

/**
 * Move a goal one step up or down the ranking. Ranks are rewritten as the
 * full 0..n−1 sequence so legacy rows (which all defaulted to rank 0)
 * normalize on first reorder.
 */
export async function moveSavingsGoalAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const id = String(form.get('id') ?? '');
  const dir = String(form.get('dir') ?? '');
  if (!id || (dir !== 'up' && dir !== 'down')) {
    return { ok: false, status: 400, data: { goalError: 'Missing goal id or direction' } };
  }
  const goals = await repo.listSavingsGoals();
  const idx = goals.findIndex((g) => g.id === id);
  const swap = dir === 'up' ? idx - 1 : idx + 1;
  if (idx === -1 || swap < 0 || swap >= goals.length) {
    return { ok: false, status: 400, data: { goalError: 'Cannot move that goal further' } };
  }
  [goals[idx], goals[swap]] = [goals[swap], goals[idx]];
  for (let rank = 0; rank < goals.length; rank++) {
    if (goals[rank].rank !== rank) await repo.setSavingsGoalRank(goals[rank].id, rank);
  }
  return { ok: true, data: { goalMoved: true } };
}

export type SavingsGoalActionName = 'addGoal' | 'updateGoal' | 'deleteGoal' | 'moveGoal';

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
    case 'moveGoal':
      return moveSavingsGoalAction(repo, form);
  }
}
