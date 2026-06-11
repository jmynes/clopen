import { describe, expect, it } from 'vitest';
import type { Expense } from '$lib/db/schema';
import { addExpenseAction, deleteExpenseAction, updateExpenseAction } from './expenses';
import { emptyRepo, type Repo } from './repo';

/** In-memory Repo stub: only the expense methods are live. */
function memRepo(): { repo: Repo; rows: Expense[] } {
  const rows: Expense[] = [];
  const repo: Repo = {
    ...emptyRepo,
    listExpenses: async () => rows,
    addExpense: async (input) => {
      const row: Expense = { id: `e${rows.length + 1}`, ...input, createdAt: 1, updatedAt: null };
      rows.push(row);
      return row;
    },
    updateExpense: async (id, input) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...input, updatedAt: 2 };
    },
    deleteExpense: async (id) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows.splice(idx, 1);
    },
  };
  return { repo, rows };
}

function fd(pairs: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(pairs)) form.set(k, v);
  return form;
}

describe('expense actions', () => {
  it('add: inserts a valid expense', async () => {
    const { repo, rows } = memRepo();
    const out = await addExpenseAction(repo, fd({ date: '2026-06-11', amount: '18.50', kind: 'ride', note: 'in' }));
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2026-06-11', amount: 18.5, kind: 'ride', note: 'in' });
  });

  it('add: surfaces validation errors without writing', async () => {
    const { repo, rows } = memRepo();
    const out = await addExpenseAction(repo, fd({ date: '2026-06-11', amount: '0', kind: 'ride' }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
    expect(String(out.data.expenseError)).toContain('greater than 0');
    expect(rows).toHaveLength(0);
  });

  it('update: edits in place', async () => {
    const { repo, rows } = memRepo();
    await addExpenseAction(repo, fd({ date: '2026-06-11', amount: '18.50', kind: 'ride' }));
    const out = await updateExpenseAction(repo, fd({ id: 'e1', date: '2026-06-12', amount: '22', kind: 'other' }));
    expect(out.ok).toBe(true);
    expect(rows[0]).toMatchObject({ date: '2026-06-12', amount: 22, kind: 'other' });
  });

  it('update/delete: reject a missing id', async () => {
    const { repo } = memRepo();
    const up = await updateExpenseAction(repo, fd({ date: '2026-06-12', amount: '22', kind: 'ride' }));
    expect(up.ok).toBe(false);
    const del = await deleteExpenseAction(repo, fd({}));
    expect(del.ok).toBe(false);
  });

  it('delete: removes the row', async () => {
    const { repo, rows } = memRepo();
    await addExpenseAction(repo, fd({ date: '2026-06-11', amount: '18.50', kind: 'ride' }));
    const out = await deleteExpenseAction(repo, fd({ id: 'e1' }));
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(0);
  });
});
