import { describe, expect, it } from 'vitest';
import { savingsGoalInput } from './savings-goal';

describe('savingsGoalInput', () => {
  it('parses form-shaped strings and trims the name', () => {
    const parsed = savingsGoalInput.parse({
      name: '  Nintendo Switch ',
      targetAmount: '349.99',
      startDate: '2026-06-12',
      funding: 'overtime',
    });
    expect(parsed).toEqual({
      name: 'Nintendo Switch',
      targetAmount: 349.99,
      startDate: '2026-06-12',
      funding: 'overtime',
      allocation: 100,
    });
  });

  it('parses an explicit allocation and rejects out-of-range ones', () => {
    const parsed = savingsGoalInput.parse({
      name: 'Switch',
      targetAmount: '100',
      startDate: '2026-06-12',
      funding: 'overtime',
      allocation: '20',
    });
    expect(parsed.allocation).toBe(20);
    expect(
      savingsGoalInput.safeParse({
        name: 'Switch',
        targetAmount: '100',
        startDate: '2026-06-12',
        funding: 'overtime',
        allocation: '101',
      }).success,
    ).toBe(false);
  });

  it('rejects a blank name', () => {
    expect(
      savingsGoalInput.safeParse({ name: '   ', targetAmount: '100', startDate: '2026-06-12', funding: 'all' }).success,
    ).toBe(false);
  });

  it('rejects a non-positive target', () => {
    expect(
      savingsGoalInput.safeParse({ name: 'Switch', targetAmount: '0', startDate: '2026-06-12', funding: 'overtime' })
        .success,
    ).toBe(false);
  });

  it('rejects a malformed date and an unknown funding mode', () => {
    expect(
      savingsGoalInput.safeParse({ name: 'Switch', targetAmount: '100', startDate: '6/12/26', funding: 'overtime' })
        .success,
    ).toBe(false);
    expect(
      savingsGoalInput.safeParse({ name: 'Switch', targetAmount: '100', startDate: '2026-06-12', funding: 'salary' })
        .success,
    ).toBe(false);
  });
});
