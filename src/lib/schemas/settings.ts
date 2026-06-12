import { z } from 'zod';
import {
  EXPENSE_KINDS,
  MEAL_METHODS,
  MEAL_VENDORS,
  PURCHASE_CADENCES,
  PURCHASE_VENDORS,
  RIDE_DIRECTIONS,
  RIDE_VENDORS,
} from '$lib/expense-kinds';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Period buckets the dashboard and ledger paginate by. */
export const LEDGER_PERIODS = ['week', 'biweek', 'month', 'quarter', 'year'] as const;
export type LedgerPeriod = (typeof LEDGER_PERIODS)[number];

export const CLOCK_BREAK_MODES = ['accrue', 'split'] as const;
export type ClockBreakMode = (typeof CLOCK_BREAK_MODES)[number];

/** How often pay lands — what the dashboard's period and chart open to. */
export const PAY_CYCLES = ['daily', 'weekly', 'biweekly', 'monthly'] as const;
export type PayCycle = (typeof PAY_CYCLES)[number];

const KNOWN_ZONES = new Set<string>(Intl.supportedValuesOf('timeZone'));

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
  timeFormat: z.enum(['12h', '24h']).default('12h'),
  ledgerPeriod: z.enum(LEDGER_PERIODS).default('month'),
  payCycle: z.enum(PAY_CYCLES).default('biweekly'),
  timeZone: z
    .string()
    .refine((v) => v === 'UTC' || KNOWN_ZONES.has(v), 'Unknown timezone')
    .default('America/Chicago'),
  observeDst: z.boolean().default(true),
  clockBreakMode: z.enum(CLOCK_BREAK_MODES).default('accrue'),
  hideWeekendsEntries: z.boolean().default(false),
  hideWeekendsGrid: z.boolean().default(false),
  expandNotes: z.boolean().default(false),
  otMultiplierEnabled: z.boolean().default(false),
  otMultiplier: z.coerce.number().min(1, 'Multiplier must be at least 1').max(10).default(1.5),
  goalEnabled: z.boolean().default(true),
  yearlyGoal: z.coerce.number().min(0, 'Goal cannot be negative').max(10_000_000).default(80000),
  countExpenses: z.boolean().default(true),
  // What the Expenses add form opens with: kind, then per-kind details.
  defaultExpenseKind: z.enum(EXPENSE_KINDS).default('ride'),
  defaultRideVendor: z.enum(RIDE_VENDORS).default('uber'),
  defaultRideDirection: z.enum(RIDE_DIRECTIONS).default('to_work'),
  defaultMealVendor: z.enum(MEAL_VENDORS).default('uber_eats'),
  defaultMealMethod: z.enum(MEAL_METHODS).default('delivery'),
  defaultPurchaseVendor: z.enum(PURCHASE_VENDORS).default('hardware'),
  defaultPurchaseCadence: z.enum(PURCHASE_CADENCES).default('monthly'),
});

export type SettingsInput = z.infer<typeof settingsInput>;

/** ISO weekday numbers stored as a JSON array string. */
export const workdaysJson = z.array(z.number().int().min(1).max(7));
