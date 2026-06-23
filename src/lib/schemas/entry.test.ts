import { describe, expect, it } from 'vitest';
import { openEntryInput } from './entry';

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
      });
    }
  });

  it('keeps a trimmed note and drops a blank one', () => {
    const withNote = openEntryInput.safeParse({ date: '2026-06-23', startTime: '09:00', note: '  hi ' });
    expect(withNote.success && withNote.data.note).toBe('hi');
    const blank = openEntryInput.safeParse({ date: '2026-06-23', startTime: '09:00', note: '   ' });
    expect(blank.success && blank.data.note).toBe(null);
  });

  it('rejects a missing/unparseable start time', () => {
    expect(openEntryInput.safeParse({ date: '2026-06-23', startTime: '' }).success).toBe(false);
    expect(openEntryInput.safeParse({ date: '2026-06-23', startTime: 'nope' }).success).toBe(false);
  });

  it('rejects a bad date', () => {
    expect(openEntryInput.safeParse({ date: '06/23/2026', startTime: '09:00' }).success).toBe(false);
  });
});
