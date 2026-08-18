import { describe, expect, it } from 'vitest';
import { classifyGridRow, type GridRowInputs } from './grid-row';

// Every case spells out only the fields it cares about.
const row = (f: Partial<GridRowInputs>): GridRowInputs => ({
  mode: 'clock',
  leave: '',
  startParsed: null,
  endParsed: null,
  hours: '',
  brk: '',
  ...f,
});

describe('classifyGridRow', () => {
  it('classifies a selected leave kind as leave (regardless of mode/fields)', () => {
    expect(
      classifyGridRow(row({ mode: 'clock', leave: 'pto', startParsed: '09:00', endParsed: '17:00', hours: '' })),
    ).toBe('leave');
    expect(
      classifyGridRow(row({ mode: 'hours', leave: 'sick_unpaid', startParsed: null, endParsed: null, hours: '8' })),
    ).toBe('leave');
  });

  it('does not classify an empty or "work" leave value as leave', () => {
    expect(
      classifyGridRow(row({ mode: 'clock', leave: '', startParsed: '09:00', endParsed: '17:00', hours: '' })),
    ).toBe('clock');
    expect(
      classifyGridRow(row({ mode: 'clock', leave: 'work', startParsed: '09:00', endParsed: '17:00', hours: '' })),
    ).toBe('clock');
  });

  describe('clock mode', () => {
    it('classifies both times parsed as clock', () => {
      expect(
        classifyGridRow(row({ mode: 'clock', leave: '', startParsed: '09:00', endParsed: '17:00', hours: '' })),
      ).toBe('clock');
    });

    it('classifies start only as open', () => {
      expect(classifyGridRow(row({ mode: 'clock', leave: '', startParsed: '09:00', endParsed: null, hours: '' }))).toBe(
        'open',
      );
    });

    it('classifies end only (no start) as open — a departure starts a row too', () => {
      expect(classifyGridRow(row({ endParsed: '17:00' }))).toBe('open');
    });

    it('classifies a lone break as open', () => {
      expect(classifyGridRow(row({ brk: '0.5' }))).toBe('open');
    });

    it('ignores a whitespace-only break', () => {
      expect(classifyGridRow(row({ brk: '  ' }))).toBe('empty');
    });

    it('classifies neither time as empty', () => {
      expect(classifyGridRow(row({ mode: 'clock', leave: '', startParsed: null, endParsed: null, hours: '' }))).toBe(
        'empty',
      );
    });
  });

  describe('hours mode', () => {
    it('classifies a non-blank hours value as hours', () => {
      expect(classifyGridRow(row({ mode: 'hours', leave: '', startParsed: null, endParsed: null, hours: '8' }))).toBe(
        'hours',
      );
    });

    it('classifies a blank hours value as empty', () => {
      expect(classifyGridRow(row({ mode: 'hours', leave: '', startParsed: null, endParsed: null, hours: '' }))).toBe(
        'empty',
      );
    });

    it('classifies a lone break as open', () => {
      expect(classifyGridRow(row({ mode: 'hours', brk: '0.5' }))).toBe('open');
    });

    it('classifies whitespace-only hours as empty', () => {
      expect(classifyGridRow(row({ mode: 'hours', leave: '', startParsed: null, endParsed: null, hours: '   ' }))).toBe(
        'empty',
      );
    });
  });
});
