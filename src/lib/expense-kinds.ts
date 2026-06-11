/**
 * Catalog of expense kinds. Rides (Uber/Lyft) are the founding use case; the
 * taxonomy is the extension point — append a kind here and the schema enum,
 * form select, and badges pick it up (the DB column is plain text, so no
 * migration). Bonus tracking is deliberately deferred; when it lands it will
 * be income, not an expense kind.
 */

export const EXPENSE_KINDS = ['ride', 'other'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export type ExpenseMeta = {
  /** Label for menus, badges, and the audit log (e.g. "Ride"). */
  label: string;
  /**
   * Tailwind classes for the kind badge (bg + text + ring). Amber is the
   * expense hue — unclaimed by the leave chips (emerald/rose/violet/sky)
   * and the audit log's indigo.
   */
  badgeClass: string;
};

export const EXPENSE_META: Record<ExpenseKind, ExpenseMeta> = {
  ride: { label: 'Ride', badgeClass: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300' },
  other: { label: 'Other', badgeClass: 'bg-zinc-500/15 text-zinc-700 ring-zinc-500/30 dark:text-zinc-300' },
};

/**
 * Ride-only detail axes: who drove and which leg of the commute. Both are
 * null on non-ride kinds (and on rides logged before these existed). Append
 * to extend — the DB columns are plain text.
 */
export const RIDE_VENDORS = ['uber', 'lyft', 'other'] as const;
export type RideVendor = (typeof RIDE_VENDORS)[number];
export const RIDE_VENDOR_LABELS: Record<RideVendor, string> = { uber: 'Uber', lyft: 'Lyft', other: 'Other' };

export const RIDE_DIRECTIONS = ['to_work', 'from_work', 'other'] as const;
export type RideDirection = (typeof RIDE_DIRECTIONS)[number];
export const RIDE_DIRECTION_LABELS: Record<RideDirection, string> = {
  to_work: 'To work',
  from_work: 'From work',
  other: 'Other',
};
