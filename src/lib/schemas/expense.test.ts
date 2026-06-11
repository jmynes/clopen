import { describe, expect, it } from 'vitest';
import { expenseInput } from './expense';

describe('expenseInput', () => {
  const valid = { date: '2026-06-11', amount: '18.50', kind: 'ride', note: 'Uber to the office' };

  it('parses a valid expense and coerces the amount', () => {
    const out = expenseInput.parse(valid);
    expect(out).toEqual({
      date: '2026-06-11',
      amount: 18.5,
      kind: 'ride',
      vendor: null,
      direction: null,
      note: 'Uber to the office',
    });
  });

  it('keeps vendor and direction on a ride', () => {
    const out = expenseInput.parse({ ...valid, vendor: 'lyft', direction: 'to_home' });
    expect(out.vendor).toBe('lyft');
    expect(out.direction).toBe('to_home');
  });

  it('forces vendor and direction to null on non-ride kinds', () => {
    const out = expenseInput.parse({ ...valid, kind: 'other', vendor: 'uber', direction: 'to_work' });
    expect(out.vendor).toBeNull();
    expect(out.direction).toBeNull();
  });

  it('rejects an unknown vendor or direction', () => {
    expect(expenseInput.safeParse({ ...valid, vendor: 'waymo' }).success).toBe(false);
    expect(expenseInput.safeParse({ ...valid, direction: 'sideways' }).success).toBe(false);
  });

  it('rejects a zero amount', () => {
    expect(expenseInput.safeParse({ ...valid, amount: '0' }).success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(expenseInput.safeParse({ ...valid, amount: '-5' }).success).toBe(false);
  });

  it('rejects a malformed date', () => {
    expect(expenseInput.safeParse({ ...valid, date: '6/11/2026' }).success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(expenseInput.safeParse({ ...valid, kind: 'bonus' }).success).toBe(false);
  });

  it('normalizes a blank note to null', () => {
    expect(expenseInput.parse({ ...valid, note: '  ' }).note).toBeNull();
    expect(expenseInput.parse({ date: valid.date, amount: valid.amount, kind: valid.kind }).note).toBeNull();
  });
});
