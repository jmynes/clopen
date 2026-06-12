/**
 * The Expenses page's load and form-action logic, Repo-agnostic like log.ts:
 * the server route wraps failures in fail(), demo mode uses outcomes directly.
 */

import type { z } from 'zod';
import type { Expense, Settings } from '$lib/db/schema';
import { expenseInput } from '$lib/schemas/expense';
import type { ActionOutcome } from './log';
import type { Repo } from './repo';

export function computeExpenses(expenses: Expense[], row: Settings) {
  return {
    expenses,
    epoch: row.epoch,
    weekStartsOn: row.weekStartsOn,
    ledgerPeriod: row.ledgerPeriod,
    // What the add form opens with (Settings → Expenses defaults).
    defaultExpenseKind: row.defaultExpenseKind,
    defaultRideVendor: row.defaultRideVendor,
    defaultRideDirection: row.defaultRideDirection,
    defaultMealVendor: row.defaultMealVendor,
    defaultMealMethod: row.defaultMealMethod,
    defaultPurchaseVendor: row.defaultPurchaseVendor,
    defaultPurchaseCadence: row.defaultPurchaseCadence,
  };
}

function flattenError(parsed: z.ZodError): string {
  return parsed.issues.map((i) => i.message).join('; ');
}

function parseExpense(form: FormData) {
  return expenseInput.safeParse({
    date: form.get('date'),
    amount: form.get('amount'),
    kind: form.get('kind'),
    vendor: form.get('vendor') ?? undefined,
    direction: form.get('direction') ?? undefined,
    method: form.get('method') ?? undefined,
    cadence: form.get('cadence') ?? undefined,
    note: form.get('note') ?? undefined,
  });
}

export async function addExpenseAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const parsed = parseExpense(form);
  if (!parsed.success) return { ok: false, status: 400, data: { expenseError: flattenError(parsed.error) } };
  await repo.addExpense(parsed.data);
  return { ok: true, data: { expenseAdded: true } };
}

export async function updateExpenseAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const id = String(form.get('id') ?? '');
  if (!id) return { ok: false, status: 400, data: { expenseError: 'Missing expense id' } };
  const parsed = parseExpense(form);
  if (!parsed.success) return { ok: false, status: 400, data: { expenseError: flattenError(parsed.error) } };
  await repo.updateExpense(id, parsed.data);
  return { ok: true, data: { expenseUpdated: true } };
}

export async function deleteExpenseAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const id = String(form.get('id') ?? '');
  if (!id) return { ok: false, status: 400, data: { expenseError: 'Missing expense id' } };
  await repo.deleteExpense(id);
  return { ok: true, data: { expenseDeleted: true } };
}

export type ExpenseActionName = 'add' | 'update' | 'delete';

/** Dispatch by SvelteKit action name ("?/add" → add). Demo mode's client router. */
export function runExpenseAction(repo: Repo, action: ExpenseActionName, form: FormData): Promise<ActionOutcome> {
  switch (action) {
    case 'add':
      return addExpenseAction(repo, form);
    case 'update':
      return updateExpenseAction(repo, form);
    case 'delete':
      return deleteExpenseAction(repo, form);
  }
}
