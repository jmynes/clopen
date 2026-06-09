import { z } from 'zod';
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

/** Canonical persisted shape. All input modes (hours / clock / PTO) produce this. */
export type EntryInput = {
  date: string;
  hours: number;
  breakHours: number;
  note: string | null;
  startTime: string | null;
  endTime: string | null;
  isPto: boolean;
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
      isPto: false,
    }),
  );

/** PTO mode: a paid day off. Worked hours come from the daily baseline; no clock times. */
export const ptoEntryInput = z
  .object({
    date,
    hours: z.coerce.number().min(0).max(24).default(8),
    note,
  })
  .transform(
    (v): EntryInput => ({
      date: v.date,
      hours: v.hours,
      breakHours: 0,
      note: v.note,
      startTime: null,
      endTime: null,
      isPto: true,
    }),
  );

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
      isPto: false,
    }),
  );
