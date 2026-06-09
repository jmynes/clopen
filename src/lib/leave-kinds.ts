/**
 * Catalog of non-work entry kinds. A `work` entry is just a regular logged
 * shift; everything else is "leave" — paid or unpaid time off that displays
 * with a colored badge. Paid leave credits the daily baseline (so a paid day
 * off doesn't put you behind); unpaid leave is recorded for context only.
 */

export const ENTRY_KINDS = [
  'work',
  'pto',
  'sick_paid',
  'sick_unpaid',
  'holiday_paid',
  'holiday_unpaid',
  'vacation_unpaid',
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const LEAVE_KINDS = [
  'pto',
  'sick_paid',
  'sick_unpaid',
  'holiday_paid',
  'holiday_unpaid',
  'vacation_unpaid',
] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];

export function isLeaveKind(v: string): v is LeaveKind {
  return (LEAVE_KINDS as readonly string[]).includes(v);
}

export type LeaveMeta = {
  /** Full label for menus and tooltips (e.g. "Sick (paid)"). */
  label: string;
  /** Short label for compact column display (e.g. "Sick"). */
  short: string;
  /** When true the entry credits `dailyHours`; otherwise it records 0h. */
  paid: boolean;
  /** Tailwind color family — drives badge background + ring. */
  color: 'emerald' | 'rose' | 'violet' | 'sky';
};

export const LEAVE_META: Record<LeaveKind, LeaveMeta> = {
  pto: { label: 'PTO', short: 'PTO', paid: true, color: 'emerald' },
  sick_paid: { label: 'Sick (paid)', short: 'Sick', paid: true, color: 'rose' },
  sick_unpaid: { label: 'Sick (unpaid)', short: 'Sick', paid: false, color: 'rose' },
  holiday_paid: { label: 'Holiday (paid)', short: 'Holiday', paid: true, color: 'violet' },
  holiday_unpaid: { label: 'Holiday (unpaid)', short: 'Holiday', paid: false, color: 'violet' },
  vacation_unpaid: { label: 'Vacation (unpaid)', short: 'Vacation', paid: false, color: 'sky' },
};

export function leaveHours(kind: LeaveKind, dailyHours: number): number {
  return LEAVE_META[kind].paid ? dailyHours : 0;
}
