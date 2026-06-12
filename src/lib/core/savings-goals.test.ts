import { describe, expect, it } from 'vitest';
import type { SavingsGoal } from '$lib/db/schema';
import { emptyRepo, type Repo } from './repo';
import {
  addSavingsGoalAction,
  deleteSavingsGoalAction,
  moveSavingsGoalAction,
  updateSavingsGoalAction,
} from './savings-goals';

/** In-memory Repo stub: only the savings-goal methods are live. */
function memRepo(): { repo: Repo; rows: SavingsGoal[] } {
  const rows: SavingsGoal[] = [];
  const sortByRank = () => rows.sort((a, b) => a.rank - b.rank || a.createdAt - b.createdAt);
  const repo: Repo = {
    ...emptyRepo,
    listSavingsGoals: async () => sortByRank(),
    addSavingsGoal: async (input) => {
      const row: SavingsGoal = {
        id: `g${rows.length + 1}`,
        rank: rows.length,
        ...input,
        createdAt: 1,
        updatedAt: null,
      };
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
    setSavingsGoalRank: async (id, rank) => {
      const row = rows.find((r) => r.id === id);
      if (row) row.rank = rank;
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

  it('move: swaps a goal with its neighbor and rewrites ranks contiguously', async () => {
    const { repo, rows } = memRepo();
    const add = (name: string) =>
      addSavingsGoalAction(repo, fd({ name, targetAmount: '100', startDate: '2026-06-12', funding: 'overtime' }));
    await add('a');
    await add('b');
    await add('c');
    const out = await moveSavingsGoalAction(repo, fd({ id: 'g3', dir: 'up' }));
    expect(out.ok).toBe(true);
    expect(rows.map((r) => r.name)).toEqual(['a', 'c', 'b']);
    expect(rows.map((r) => r.rank)).toEqual([0, 1, 2]);
  });

  it('move: first goal up and missing ids are rejected', async () => {
    const { repo } = memRepo();
    await addSavingsGoalAction(
      repo,
      fd({ name: 'a', targetAmount: '100', startDate: '2026-06-12', funding: 'overtime' }),
    );
    expect((await moveSavingsGoalAction(repo, fd({ id: 'g1', dir: 'up' }))).ok).toBe(false);
    expect((await moveSavingsGoalAction(repo, fd({ id: 'nope', dir: 'down' }))).ok).toBe(false);
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
