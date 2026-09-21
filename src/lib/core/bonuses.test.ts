import { describe, expect, it } from 'vitest';
import type { Bonus } from '$lib/db/schema';
import { addBonusAction, bonusLabelOf, deleteBonusAction, updateBonusAction } from './bonuses';
import { emptyRepo, type Repo } from './repo';

/** In-memory Repo stub: only the bonus methods are live. */
function memRepo(): { repo: Repo; rows: Bonus[] } {
  const rows: Bonus[] = [];
  const repo: Repo = {
    ...emptyRepo,
    listBonuses: async () => rows,
    addBonus: async (input) => {
      const row: Bonus = { id: `b${rows.length + 1}`, ...input, createdAt: 1, updatedAt: null };
      rows.push(row);
      return row;
    },
    updateBonus: async (id, input) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...input, updatedAt: 2 };
    },
    deleteBonus: async (id) => {
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

describe('bonus actions', () => {
  it('adds a valid bonus', async () => {
    const { repo, rows } = memRepo();
    const out = await addBonusAction(repo, fd({ date: '2026-09-15', amount: '2000', label: 'Q3 performance' }));
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2026-09-15', amount: 2000, label: 'Q3 performance' });
  });

  it('blanks a whitespace-only label and note', async () => {
    const { repo, rows } = memRepo();
    await addBonusAction(repo, fd({ date: '2026-09-15', amount: '500', label: '   ', note: '  ' }));
    expect(rows[0].label).toBeNull();
    expect(rows[0].note).toBeNull();
  });

  it('rejects a non-positive amount', async () => {
    const { repo, rows } = memRepo();
    const out = await addBonusAction(repo, fd({ date: '2026-09-15', amount: '0' }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it('rejects a malformed date', async () => {
    const { repo } = memRepo();
    const out = await addBonusAction(repo, fd({ date: '9/15/2026', amount: '100' }));
    expect(out.ok).toBe(false);
  });

  it('rejects a label past the cap', async () => {
    const { repo } = memRepo();
    const out = await addBonusAction(repo, fd({ date: '2026-09-15', amount: '100', label: 'x'.repeat(41) }));
    expect(out.ok).toBe(false);
  });

  it('updates and deletes by id, and refuses a missing one', async () => {
    const { repo, rows } = memRepo();
    await addBonusAction(repo, fd({ date: '2026-09-15', amount: '2000' }));

    expect((await updateBonusAction(repo, fd({ id: '', date: '2026-09-15', amount: '1' }))).ok).toBe(false);
    await updateBonusAction(repo, fd({ id: 'b1', date: '2026-09-16', amount: '2500' }));
    expect(rows[0]).toMatchObject({ date: '2026-09-16', amount: 2500 });

    expect((await deleteBonusAction(repo, fd({}))).ok).toBe(false);
    await deleteBonusAction(repo, fd({ id: 'b1' }));
    expect(rows).toHaveLength(0);
  });
});

describe('bonusLabelOf', () => {
  it('falls back to "Bonus" when blank', () => {
    expect(bonusLabelOf(null)).toBe('Bonus');
    expect(bonusLabelOf('  ')).toBe('Bonus');
    expect(bonusLabelOf('Referral')).toBe('Referral');
  });
});
