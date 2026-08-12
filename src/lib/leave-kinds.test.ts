import { describe, expect, it } from 'vitest';
import {
  ENTRY_KINDS,
  isLeaveKind,
  isOtherKind,
  LEAVE_KINDS,
  LEAVE_META,
  leaveBadgeOf,
  leaveHours,
} from './leave-kinds';

describe('other leave kinds', () => {
  it('are part of both kind lists', () => {
    expect(ENTRY_KINDS).toContain('other_paid');
    expect(ENTRY_KINDS).toContain('other_unpaid');
    expect(LEAVE_KINDS).toContain('other_paid');
    expect(LEAVE_KINDS).toContain('other_unpaid');
    expect(isLeaveKind('other_paid')).toBe(true);
    expect(isLeaveKind('other_unpaid')).toBe(true);
  });

  it('are pinned last, after the named categories', () => {
    expect(LEAVE_KINDS.slice(-2)).toEqual(['other_paid', 'other_unpaid']);
  });

  it('credit the daily baseline only when paid', () => {
    expect(LEAVE_META.other_paid.paid).toBe(true);
    expect(LEAVE_META.other_unpaid.paid).toBe(false);
    expect(leaveHours('other_paid', 8)).toBe(8);
    expect(leaveHours('other_unpaid', 8)).toBe(0);
  });

  it('share the neutral color family', () => {
    expect(LEAVE_META.other_paid.color).toBe('slate');
    expect(LEAVE_META.other_unpaid.color).toBe('slate');
  });
});

describe('isOtherKind', () => {
  it('is true only for the two other kinds', () => {
    expect(isOtherKind('other_paid')).toBe(true);
    expect(isOtherKind('other_unpaid')).toBe(true);
    expect(isOtherKind('sick_paid')).toBe(false);
    expect(isOtherKind('work')).toBe(false);
  });
});

describe('leaveBadgeOf', () => {
  it('shows the typed label for other kinds', () => {
    expect(leaveBadgeOf('other_paid', 'Jury duty')).toBe('Jury duty');
    expect(leaveBadgeOf('other_unpaid', 'Moving day')).toBe('Moving day');
  });

  it('falls back to the short label when no text was typed', () => {
    expect(leaveBadgeOf('other_paid', null)).toBe('Other');
    expect(leaveBadgeOf('other_paid', '')).toBe('Other');
    expect(leaveBadgeOf('other_paid', '   ')).toBe('Other');
  });

  it('ignores a stray label on a named kind', () => {
    expect(leaveBadgeOf('sick_paid', 'Jury duty')).toBe('Sick');
    expect(leaveBadgeOf('vacation_unpaid', null)).toBe('Vacation');
  });
});
