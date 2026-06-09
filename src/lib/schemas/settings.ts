import { z } from 'zod';

/** Validated shape for the single settings row (form-friendly: numbers coerced). */
export const settingsInput = z.object({
  hourlyRate: z.coerce.number().min(0, 'Rate cannot be negative').max(100_000),
  dailyHours: z.coerce.number().positive('Daily hours must be greater than 0').max(24),
  workdays: z.array(z.number().int().min(1).max(7)).min(1, 'Pick at least one workday'),
});

export type SettingsInput = z.infer<typeof settingsInput>;

/** ISO weekday numbers stored as a JSON array string. */
export const workdaysJson = z.array(z.number().int().min(1).max(7));
