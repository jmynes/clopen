import { z } from 'zod';
import {
  EXPENSE_KINDS,
  type ExpenseKind,
  RIDE_DIRECTIONS,
  RIDE_VENDORS,
  type RideDirection,
  type RideVendor,
} from '$lib/expense-kinds';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Canonical persisted shape for one expense. Vendor/direction are ride-only. */
export type ExpenseInput = {
  date: string;
  amount: number;
  kind: ExpenseKind;
  vendor: RideVendor | null;
  direction: RideDirection | null;
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
    vendor: z.enum(RIDE_VENDORS).optional(),
    direction: z.enum(RIDE_DIRECTIONS).optional(),
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
      // The detail axes only mean anything on a ride; scrub them elsewhere so
      // a stale hidden field can't attach "Uber" to a non-ride expense.
      vendor: v.kind === 'ride' ? (v.vendor ?? null) : null,
      direction: v.kind === 'ride' ? (v.direction ?? null) : null,
      note: v.note,
    }),
  );
