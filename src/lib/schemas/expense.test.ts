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
      method: null,
      note: 'Uber to the office',
    });
  });

  it('keeps vendor and direction on a ride', () => {
    const out = expenseInput.parse({ ...valid, vendor: 'lyft', direction: 'to_home' });
    expect(out.vendor).toBe('lyft');
    expect(out.direction).toBe('to_home');
  });

  it('keeps vendor and method on a meal', () => {
    const out = expenseInput.parse({ ...valid, kind: 'meal', vendor: 'uber_eats', method: 'pickup' });
    expect(out.vendor).toBe('uber_eats');
    expect(out.method).toBe('pickup');
  });

  it('scrubs detail axes that do not belong to the kind', () => {
    // A meal vendor on a ride, a direction on a meal, a method on a ride.
    expect(expenseInput.parse({ ...valid, vendor: 'grubhub' }).vendor).toBeNull();
    expect(
      expenseInput.parse({ ...valid, kind: 'meal', vendor: 'restaurant', direction: 'to_work' }).direction,
    ).toBeNull();
    expect(expenseInput.parse({ ...valid, vendor: 'uber', method: 'delivery' }).method).toBeNull();
    const other = expenseInput.parse({
      ...valid,
      kind: 'other',
      vendor: 'uber',
      direction: 'to_work',
      method: 'pickup',
    });
    expect([other.vendor, other.direction, other.method]).toEqual([null, null, null]);
  });

  it('rejects an unknown vendor, direction, or method', () => {
    expect(expenseInput.safeParse({ ...valid, vendor: 'waymo' }).success).toBe(false);
    expect(expenseInput.safeParse({ ...valid, direction: 'sideways' }).success).toBe(false);
    expect(expenseInput.safeParse({ ...valid, kind: 'meal', method: 'teleport' }).success).toBe(false);
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
