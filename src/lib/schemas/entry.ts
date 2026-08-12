import { z } from 'zod';
import { type EntryKind, isOtherKind, KIND_LABEL_MAX, LEAVE_KINDS, LEAVE_META } from '$lib/leave-kinds';
import { hoursBetween, parseTimeInput } from '$lib/timesheet';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Accepts loose input (2pm, 230pm, 2:00, 14:00) and normalizes to HH:MM.
const clockTime = z.string().transform((v, ctx) => {
  const parsed = parseTimeInput(v);
  if (parsed === null) {
    ctx.addIssue({ code: 'custom', message: 'Enter a time like 2:30pm' });
    return z.NEVER;
  }
  return parsed;
});

/** Canonical persisted shape. Every input mode (hours / clock / leave) produces this. */
export type EntryInput = {
  date: string;
  hours: number;
  breakHours: number;
  note: string | null;
  startTime: string | null;
  endTime: string | null;
  entryKind: EntryKind;
  /**
   * Free-text badge label, only ever set on the `other_*` kinds. Every other
   * kind wears its category name, so the field is scrubbed to null there.
   */
  kindLabel: string | null;
};

const date = z.string().regex(ISO_DATE, 'Date must be YYYY-MM-DD');
const breakHours = z.coerce.number().min(0, 'Break cannot be negative').max(24).default(0);
const note = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null);

/** "Just hours" mode: hours typed directly; no clock times. */
export const entryInput = z
  .object({
    date,
    hours: z.coerce.number().positive('Hours must be greater than 0').max(24, 'A single entry cannot exceed 24h'),
    breakHours,
    note,
  })
  .refine((v) => v.breakHours < v.hours, { error: 'Break must be less than hours worked', path: ['breakHours'] })
  .transform(
    (v): EntryInput => ({
      date: v.date,
      hours: v.hours,
      breakHours: v.breakHours,
      note: v.note,
      startTime: null,
      endTime: null,
      entryKind: 'work',
      kindLabel: null,
    }),
  );

const leaveKind = z.enum(LEAVE_KINDS as unknown as [string, ...string[]]);

/**
 * Leave mode: PTO / sick / holiday / vacation — paid or unpaid. Paid kinds
 * credit `dailyHours`; unpaid kinds record 0h. No clock times in either case.
 */
export const leaveEntryInput = z
  .object({
    date,
    kind: leaveKind,
    dailyHours: z.coerce.number().positive().max(24).default(8),
    note,
    kindLabel: z
      .string()
      .trim()
      .max(KIND_LABEL_MAX, `Label cannot exceed ${KIND_LABEL_MAX} characters`)
      .optional()
      .transform((v) => v || null),
  })
  .transform((v): EntryInput => {
    const kind = v.kind as (typeof LEAVE_KINDS)[number];
    const paid = LEAVE_META[kind].paid;
    return {
      date: v.date,
      hours: paid ? v.dailyHours : 0,
      breakHours: 0,
      note: v.note,
      startTime: null,
      endTime: null,
      entryKind: kind,
      // The label belongs to the catch-all kinds alone; a stray one arriving
      // with Sick or Holiday is dropped rather than quietly persisted.
      kindLabel: isOtherKind(kind) ? v.kindLabel : null,
    };
  });

/** Clock mode: start/end times entered; worked hours are their difference. */
export const clockEntryInput = z
  .object({
    date,
    startTime: clockTime,
    endTime: clockTime,
    breakHours,
    note,
  })
  .refine((v) => hoursBetween(v.startTime, v.endTime) > 0, {
    error: "Clock in and clock out can't match",
    path: ['endTime'],
  })
  .refine((v) => v.breakHours < hoursBetween(v.startTime, v.endTime), {
    error: 'Break must be less than worked time',
    path: ['breakHours'],
  })
  .transform(
    (v): EntryInput => ({
      date: v.date,
      hours: hoursBetween(v.startTime, v.endTime),
      breakHours: v.breakHours,
      note: v.note,
      startTime: v.startTime,
      endTime: v.endTime,
      entryKind: 'work',
      kindLabel: null,
    }),
  );

/**
 * Open mode: an arrival with no departure yet — a started, unfinished shift.
 * Records the clock-in, 0 worked hours, and no break (a break needs a span;
 * it's captured when the out is filled and the row becomes a clock entry).
 */
export const openEntryInput = z
  .object({
    date,
    startTime: clockTime,
    note,
  })
  .transform(
    (v): EntryInput => ({
      date: v.date,
      hours: 0,
      breakHours: 0,
      note: v.note,
      startTime: v.startTime,
      endTime: null,
      entryKind: 'work',
      kindLabel: null,
    }),
  );
