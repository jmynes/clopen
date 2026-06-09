import { z } from 'zod';
import { hoursBetween } from '$lib/timesheet';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

/** Canonical persisted shape. Both input modes (hours / clock) produce this. */
export type EntryInput = {
  date: string;
  hours: number;
  breakHours: number;
  note: string | null;
  startTime: string | null;
  endTime: string | null;
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
    }),
  );

/** Clock mode: start/end times entered; worked hours are their difference. */
export const clockEntryInput = z
  .object({
    date,
    startTime: z.string().regex(HHMM, 'Start must be HH:MM'),
    endTime: z.string().regex(HHMM, 'End must be HH:MM'),
    breakHours,
    note,
  })
  .refine((v) => hoursBetween(v.startTime, v.endTime) > 0, { error: 'End must be after start', path: ['endTime'] })
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
    }),
  );
