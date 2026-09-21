import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** How long a bonus's free-text label may be, matching the leave-kind cap. */
export const BONUS_LABEL_MAX = 40;

/** Canonical persisted shape for one bonus. */
export type BonusInput = {
  date: string;
  amount: number;
  label: string | null;
  note: string | null;
};

export const bonusInput = z
  .object({
    date: z.string().regex(ISO_DATE, 'Date must be YYYY-MM-DD'),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than 0')
      .max(1_000_000, 'A single bonus cannot exceed $1,000,000'),
    label: z
      .string()
      .trim()
      .max(BONUS_LABEL_MAX, `Label cannot exceed ${BONUS_LABEL_MAX} characters`)
      .optional()
      .transform((v) => v || null),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null),
  })
  .transform(
    (v): BonusInput => ({
      date: v.date,
      amount: v.amount,
      label: v.label,
      note: v.note,
    }),
  );
