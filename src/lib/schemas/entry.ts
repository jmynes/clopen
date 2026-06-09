import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validated shape for creating or editing a time entry (form-friendly: numbers coerced). */
export const entryInput = z
  .object({
    date: z.string().regex(ISO_DATE, 'Date must be YYYY-MM-DD'),
    hours: z.coerce.number().positive('Hours must be greater than 0').max(24, 'A single entry cannot exceed 24h'),
    breakHours: z.coerce.number().min(0, 'Break cannot be negative').max(24).default(0),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null),
  })
  .refine((v) => v.breakHours < v.hours, {
    error: 'Break must be less than hours worked',
    path: ['breakHours'],
  });

export type EntryInput = z.infer<typeof entryInput>;
