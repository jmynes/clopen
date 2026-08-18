import { describe, expect, it } from 'vitest';
import { entryInput, leaveEntryInput, openEntryInput } from './entry';

describe('openEntryInput', () => {
  it('parses an arrival into an open work entry with 0 hours', () => {
    const parsed = openEntryInput.safeParse({ date: '2026-06-23', startTime: '9am' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        date: '2026-06-23',
        hours: 0,
        breakHours: 0,
        note: null,
        startTime: '09:00',
        endTime: null,
        entryKind: 'work',
        kindLabel: null,
      });
    }
  });

  it('keeps a trimmed note and drops a blank one', () => {
    const withNote = openEntryInput.safeParse({ date: '2026-06-23', startTime: '09:00', note: '  hi ' });
    expect(withNote.success && withNote.data.note).toBe('hi');
    const blank = openEntryInput.safeParse({ date: '2026-06-23', startTime: '09:00', note: '   ' });
    expect(blank.success && blank.data.note).toBe(null);
  });

  it('keeps a break typed before the clock-out arrives', () => {
    const parsed = openEntryInput.safeParse({ date: '2026-06-23', startTime: '09:00', breakHours: '0.5' });
    expect(parsed.success && parsed.data.breakHours).toBe(0.5);
    expect(parsed.success && parsed.data.hours).toBe(0);
  });

  it('parses a departure with no arrival into an open entry', () => {
    const parsed = openEntryInput.safeParse({ date: '2026-06-23', endTime: '5pm' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        date: '2026-06-23',
        hours: 0,
        breakHours: 0,
        note: null,
        startTime: null,
        endTime: '17:00',
        entryKind: 'work',
        kindLabel: null,
      });
    }
  });

  it('parses a lone break into an open entry with no punches', () => {
    const parsed = openEntryInput.safeParse({ date: '2026-06-23', breakHours: '0.5' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({ hours: 0, breakHours: 0.5, startTime: null, endTime: null });
    }
  });

  it('rejects an unparseable time', () => {
    expect(openEntryInput.safeParse({ date: '2026-06-23', startTime: 'nope' }).success).toBe(false);
    expect(openEntryInput.safeParse({ date: '2026-06-23', endTime: 'nope' }).success).toBe(false);
  });

  it('rejects a row with nothing in it at all', () => {
    expect(openEntryInput.safeParse({ date: '2026-06-23' }).success).toBe(false);
    expect(openEntryInput.safeParse({ date: '2026-06-23', startTime: '', endTime: '', breakHours: '0' }).success).toBe(
      false,
    );
  });

  it('rejects a bad date', () => {
    expect(openEntryInput.safeParse({ date: '06/23/2026', startTime: '09:00' }).success).toBe(false);
  });
});

describe('leaveEntryInput with an "other" kind', () => {
  const base = { date: '2026-06-23', dailyHours: 8 };

  it('keeps the typed label and credits the baseline when paid', () => {
    const parsed = leaveEntryInput.safeParse({ ...base, kind: 'other_paid', kindLabel: 'Jury duty' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.entryKind).toBe('other_paid');
      expect(parsed.data.kindLabel).toBe('Jury duty');
      expect(parsed.data.hours).toBe(8);
    }
  });

  it('records 0h when unpaid but still keeps the label', () => {
    const parsed = leaveEntryInput.safeParse({ ...base, kind: 'other_unpaid', kindLabel: 'Moving day' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hours).toBe(0);
      expect(parsed.data.kindLabel).toBe('Moving day');
    }
  });

  it('trims the label and nulls a blank one', () => {
    const trimmed = leaveEntryInput.safeParse({ ...base, kind: 'other_paid', kindLabel: '  Jury duty  ' });
    expect(trimmed.success && trimmed.data.kindLabel).toBe('Jury duty');
    const blank = leaveEntryInput.safeParse({ ...base, kind: 'other_paid', kindLabel: '   ' });
    expect(blank.success && blank.data.kindLabel).toBe(null);
    const missing = leaveEntryInput.safeParse({ ...base, kind: 'other_paid' });
    expect(missing.success && missing.data.kindLabel).toBe(null);
  });

  it('rejects a label longer than the cap', () => {
    const parsed = leaveEntryInput.safeParse({ ...base, kind: 'other_paid', kindLabel: 'x'.repeat(41) });
    expect(parsed.success).toBe(false);
  });

  it('scrubs the label off a named kind', () => {
    const parsed = leaveEntryInput.safeParse({ ...base, kind: 'sick_paid', kindLabel: 'Jury duty' });
    expect(parsed.success && parsed.data.kindLabel).toBe(null);
  });

  it('leaves every other entry mode label-free', () => {
    const work = entryInput.safeParse({ date: '2026-06-23', hours: 8 });
    expect(work.success && work.data.kindLabel).toBe(null);
  });
});
