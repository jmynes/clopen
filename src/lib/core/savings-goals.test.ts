import { describe, expect, it } from 'vitest';
import type { SavingsGoal } from '$lib/db/schema';
import { emptyRepo, type Repo } from './repo';
import { addSavingsGoalAction, deleteSavingsGoalAction, updateSavingsGoalAction } from './savings-goals';

/** In-memory Repo stub: only the savings-goal methods are live. */
function memRepo(): { repo: Repo; rows: SavingsGoal[] } {
  const rows: SavingsGoal[] = [];
  const repo: Repo = {
    ...emptyRepo,
    listSavingsGoals: async () => rows,
    addSavingsGoal: async (input) => {
      const row: SavingsGoal = { id: `g${rows.length + 1}`, ...input, createdAt: 1, updatedAt: null };
      rows.push(row);
      return row;
    },
    updateSavingsGoal: async (id, input) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...input, updatedAt: 2 };
    },
    deleteSavingsGoal: async (id) => {
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

describe('savings goal actions', () => {
  it('add: inserts a valid goal', async () => {
    const { repo, rows } = memRepo();
    const out = await addSavingsGoalAction(
      repo,
      fd({ name: 'Nintendo Switch', targetAmount: '349.99', startDate: '2026-06-12', funding: 'overtime' }),
    );
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Nintendo Switch', targetAmount: 349.99, funding: 'overtime' });
  });

  it('add: surfaces validation errors without writing', async () => {
    const { repo, rows } = memRepo();
    const out = await addSavingsGoalAction(
      repo,
      fd({ name: '', targetAmount: '349.99', startDate: '2026-06-12', funding: 'overtime' }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
    expect(String(out.data.goalError)).toContain('Name');
    expect(rows).toHaveLength(0);
  });

  it('update: edits in place', async () => {
    const { repo, rows } = memRepo();
    await addSavingsGoalAction(
      repo,
      fd({ name: 'Switch', targetAmount: '350', startDate: '2026-06-12', funding: 'overtime' }),
    );
    const out = await updateSavingsGoalAction(
      repo,
      fd({ id: 'g1', name: 'Switch 2', targetAmount: '450', startDate: '2026-06-01', funding: 'all' }),
    );
    expect(out.ok).toBe(true);
    expect(rows[0]).toMatchObject({ name: 'Switch 2', targetAmount: 450, startDate: '2026-06-01', funding: 'all' });
  });

  it('update/delete: reject a missing id', async () => {
    const { repo } = memRepo();
    const up = await updateSavingsGoalAction(
      repo,
      fd({ name: 'Switch', targetAmount: '350', startDate: '2026-06-12', funding: 'overtime' }),
    );
    expect(up.ok).toBe(false);
    const del = await deleteSavingsGoalAction(repo, fd({}));
    expect(del.ok).toBe(false);
  });

  it('delete: removes the row', async () => {
    const { repo, rows } = memRepo();
    await addSavingsGoalAction(
      repo,
      fd({ name: 'Switch', targetAmount: '350', startDate: '2026-06-12', funding: 'overtime' }),
    );
    const out = await deleteSavingsGoalAction(repo, fd({ id: 'g1' }));
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(0);
  });
});
