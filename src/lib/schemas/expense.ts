import { z } from 'zod';
import {
  EXPENSE_KINDS,
  EXPENSE_VENDORS,
  type ExpenseKind,
  type ExpenseVendor,
  KIND_VENDORS,
  MEAL_METHODS,
  type MealMethod,
  RIDE_DIRECTIONS,
  type RideDirection,
} from '$lib/expense-kinds';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Canonical persisted shape for one expense. The detail axes are per-kind:
 * vendor is scoped by KIND_VENDORS, direction is ride-only, method meal-only.
 */
export type ExpenseInput = {
  date: string;
  amount: number;
  kind: ExpenseKind;
  vendor: ExpenseVendor | null;
  direction: RideDirection | null;
  method: MealMethod | null;
  note: string | null;
};

export const expenseInput = z
  .object({
    date: z.string().regex(ISO_DATE, 'Date must be YYYY-MM-DD'),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than 0')
      .max(100_000, 'A single expense cannot exceed $100,000'),
    kind: z.enum(EXPENSE_KINDS),
    vendor: z.enum(EXPENSE_VENDORS).optional(),
    direction: z.enum(RIDE_DIRECTIONS).optional(),
    method: z.enum(MEAL_METHODS).optional(),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null),
  })
  .transform(
    (v): ExpenseInput => ({
      date: v.date,
      amount: v.amount,
      kind: v.kind,
      // Each detail axis only means anything on its own kind; scrub the rest
      // so a stale hidden field can't attach "Uber" to a meal or vice versa.
      vendor: v.vendor && KIND_VENDORS[v.kind].includes(v.vendor) ? v.vendor : null,
      direction: v.kind === 'ride' ? (v.direction ?? null) : null,
      method: v.kind === 'meal' ? (v.method ?? null) : null,
      note: v.note,
    }),
  );
