import { z } from 'zod';
import { EXPENSE_KINDS, type ExpenseKind } from '$lib/expense-kinds';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Canonical persisted shape for one expense. */
export type ExpenseInput = {
  date: string;
  amount: number;
  kind: ExpenseKind;
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
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null),
  })
  .transform((v): ExpenseInput => ({ date: v.date, amount: v.amount, kind: v.kind, note: v.note }));
