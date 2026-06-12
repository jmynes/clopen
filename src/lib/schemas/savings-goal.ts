import { z } from 'zod';
import { GOAL_FUNDINGS } from '$lib/savings-goals';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const savingsGoalInput = z.object({
  name: z.string().trim().min(1, 'Name the goal').max(80, 'Goal names cap at 80 characters'),
  targetAmount: z.coerce
    .number()
    .positive('Target must be greater than 0')
    .max(1_000_000, 'A goal cannot exceed $1,000,000'),
  startDate: z.string().regex(ISO_DATE, 'Start date must be YYYY-MM-DD'),
  funding: z.enum(GOAL_FUNDINGS),
  /** Percent share of the savings stream; spare from reached goals spills up the ranking. */
  allocation: z.coerce
    .number()
    .min(0, 'Allocation cannot be negative')
    .max(100, 'Allocation cannot exceed 100%')
    .default(100),
});

/** Canonical persisted shape for one savings goal. */
export type SavingsGoalInput = z.infer<typeof savingsGoalInput>;
