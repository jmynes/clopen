import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validated shape for the single settings row (form-friendly: numbers coerced). */
export const settingsInput = z.object({
  hourlyRate: z.coerce.number().min(0, 'Rate cannot be negative').max(100_000),
  dailyHours: z.coerce.number().positive('Daily hours must be greater than 0').max(24),
  workdays: z.array(z.number().int().min(1).max(7)).min(1, 'Pick at least one workday'),
  weekStartsOn: z.coerce
    .number()
    .int()
    .refine((v) => v === 1 || v === 7, 'Week must start on Monday or Sunday'),
  epoch: z.string().regex(ISO_DATE, 'Epoch must be a date like 2025-03-16'),
});

export type SettingsInput = z.infer<typeof settingsInput>;

/** ISO weekday numbers stored as a JSON array string. */
export const workdaysJson = z.array(z.number().int().min(1).max(7));
