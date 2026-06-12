import { z } from 'zod';
import {
  EXPENSE_KINDS,
  EXPENSE_VENDORS,
  type ExpenseKind,
  type ExpenseVendor,
  KIND_VENDORS,
  MEAL_METHODS,
  type MealMethod,
  PURCHASE_CADENCES,
  type PurchaseCadence,
  RIDE_DIRECTIONS,
  type RideDirection,
  vendorMethods,
} from '$lib/expense-kinds';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Canonical persisted shape for one expense. The detail axes are per-kind:
 * vendor is scoped by KIND_VENDORS, direction is ride-only, method meal-only
 * (and dine-in restaurant-only), cadence subscription-purchase-only.
 */
export type ExpenseInput = {
  date: string;
  amount: number;
  kind: ExpenseKind;
  vendor: ExpenseVendor | null;
  direction: RideDirection | null;
  method: MealMethod | null;
  cadence: PurchaseCadence | null;
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
    cadence: z.enum(PURCHASE_CADENCES).optional(),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null),
  })
  .transform((v): ExpenseInput => {
    // Each detail axis only means anything on its own kind; scrub the rest
    // so a stale hidden field can't attach "Uber" to a meal or vice versa.
    const vendor = v.vendor && KIND_VENDORS[v.kind].includes(v.vendor) ? v.vendor : null;
    return {
      date: v.date,
      amount: v.amount,
      kind: v.kind,
      vendor,
      direction: v.kind === 'ride' ? (v.direction ?? null) : null,
      method: v.kind === 'meal' && v.method && vendorMethods(vendor).includes(v.method) ? v.method : null,
      cadence: v.kind === 'purchase' && vendor === 'subscription' ? (v.cadence ?? null) : null,
      note: v.note,
    };
  });
