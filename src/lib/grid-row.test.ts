import { describe, expect, it } from 'vitest';
import { classifyGridRow } from './grid-row';

describe('classifyGridRow', () => {
  it('classifies a selected leave kind as leave (regardless of mode/fields)', () => {
    expect(classifyGridRow({ mode: 'clock', leave: 'pto', startParsed: '09:00', endParsed: '17:00', hours: '' })).toBe(
      'leave',
    );
    expect(
      classifyGridRow({ mode: 'hours', leave: 'sick_unpaid', startParsed: null, endParsed: null, hours: '8' }),
    ).toBe('leave');
  });

  it('does not classify an empty or "work" leave value as leave', () => {
    expect(classifyGridRow({ mode: 'clock', leave: '', startParsed: '09:00', endParsed: '17:00', hours: '' })).toBe(
      'clock',
    );
    expect(classifyGridRow({ mode: 'clock', leave: 'work', startParsed: '09:00', endParsed: '17:00', hours: '' })).toBe(
      'clock',
    );
  });

  describe('clock mode', () => {
    it('classifies both times parsed as clock', () => {
      expect(classifyGridRow({ mode: 'clock', leave: '', startParsed: '09:00', endParsed: '17:00', hours: '' })).toBe(
        'clock',
      );
    });

    it('classifies start only as open', () => {
      expect(classifyGridRow({ mode: 'clock', leave: '', startParsed: '09:00', endParsed: null, hours: '' })).toBe(
        'open',
      );
    });

    it('classifies end only (no start) as partial', () => {
      expect(classifyGridRow({ mode: 'clock', leave: '', startParsed: null, endParsed: '17:00', hours: '' })).toBe(
        'partial',
      );
    });

    it('classifies neither time as empty', () => {
      expect(classifyGridRow({ mode: 'clock', leave: '', startParsed: null, endParsed: null, hours: '' })).toBe(
        'empty',
      );
    });
  });

  describe('hours mode', () => {
    it('classifies a non-blank hours value as hours', () => {
      expect(classifyGridRow({ mode: 'hours', leave: '', startParsed: null, endParsed: null, hours: '8' })).toBe(
        'hours',
      );
    });

    it('classifies a blank hours value as empty', () => {
      expect(classifyGridRow({ mode: 'hours', leave: '', startParsed: null, endParsed: null, hours: '' })).toBe(
        'empty',
      );
    });

    it('classifies whitespace-only hours as empty', () => {
      expect(classifyGridRow({ mode: 'hours', leave: '', startParsed: null, endParsed: null, hours: '   ' })).toBe(
        'empty',
      );
    });
  });
});
