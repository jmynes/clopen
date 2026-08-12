/**
 * Catalog of non-work entry kinds. A `work` entry is just a regular logged
 * shift; everything else is "leave" — paid or unpaid time off that displays
 * with a colored badge. Paid leave credits the daily baseline (so a paid day
 * off doesn't put you behind); unpaid leave is recorded for context only.
 */

export const ENTRY_KINDS = [
  'work',
  'pto',
  'pto_unpaid',
  'sick_paid',
  'sick_unpaid',
  'holiday_paid',
  'holiday_unpaid',
  'vacation_paid',
  'vacation_unpaid',
  'other_paid',
  'other_unpaid',
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const LEAVE_KINDS = [
  'pto',
  'pto_unpaid',
  'sick_paid',
  'sick_unpaid',
  'holiday_paid',
  'holiday_unpaid',
  'vacation_paid',
  'vacation_unpaid',
  'other_paid',
  'other_unpaid',
] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];

export function isLeaveKind(v: string): v is LeaveKind {
  return (LEAVE_KINDS as readonly string[]).includes(v);
}

/**
 * The catch-all kinds. Unlike the named categories these carry a free-text
 * `kindLabel` on the entry, which stands in for the badge text; the label is
 * meaningless on every other kind and is scrubbed to null there.
 */
export const OTHER_KINDS = ['other_paid', 'other_unpaid'] as const;

export function isOtherKind(v: string): v is (typeof OTHER_KINDS)[number] {
  return (OTHER_KINDS as readonly string[]).includes(v);
}

export type LeaveMeta = {
  /** Full label for menus and tooltips (e.g. "Sick (paid)"). */
  label: string;
  /** Short label for compact column display (e.g. "Sick"). */
  short: string;
  /** When true the entry credits `dailyHours`; otherwise it records 0h. */
  paid: boolean;
  /** Tailwind color family — drives badge background + ring. */
  color: 'emerald' | 'rose' | 'violet' | 'sky' | 'slate';
};

export const LEAVE_META: Record<LeaveKind, LeaveMeta> = {
  pto: { label: 'PTO (paid)', short: 'PTO', paid: true, color: 'emerald' },
  pto_unpaid: { label: 'UPTO (unpaid)', short: 'UPTO', paid: false, color: 'emerald' },
  sick_paid: { label: 'Sick (paid)', short: 'Sick', paid: true, color: 'rose' },
  sick_unpaid: { label: 'Sick (unpaid)', short: 'Sick', paid: false, color: 'rose' },
  holiday_paid: { label: 'Holiday (paid)', short: 'Holiday', paid: true, color: 'violet' },
  holiday_unpaid: { label: 'Holiday (unpaid)', short: 'Holiday', paid: false, color: 'violet' },
  vacation_paid: { label: 'Vacation (paid)', short: 'Vacation', paid: true, color: 'sky' },
  vacation_unpaid: { label: 'Vacation (unpaid)', short: 'Vacation', paid: false, color: 'sky' },
  other_paid: { label: 'Other (paid)', short: 'Other', paid: true, color: 'slate' },
  other_unpaid: { label: 'Other (unpaid)', short: 'Other', paid: false, color: 'slate' },
};

export function leaveHours(kind: LeaveKind, dailyHours: number): number {
  return LEAVE_META[kind].paid ? dailyHours : 0;
}

/** Longest `kindLabel` we store — keeps a stray paragraph out of the badge. */
export const KIND_LABEL_MAX = 40;

/**
 * Badge text for a leave entry: an "other" kind wears whatever was typed into
 * its label, and everything else (including an other kind left blank) wears the
 * category's short name. The single place this fallback is decided.
 */
export function leaveBadgeOf(kind: LeaveKind, kindLabel: string | null | undefined): string {
  if (isOtherKind(kind)) {
    const trimmed = kindLabel?.trim();
    if (trimmed) return trimmed;
  }
  return LEAVE_META[kind].short;
}
