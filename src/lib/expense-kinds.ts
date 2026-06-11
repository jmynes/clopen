/**
 * Catalog of expense kinds. Rides (Uber/Lyft) are the founding use case; the
 * taxonomy is the extension point — append a kind here and the schema enum,
 * form select, and badges pick it up (the DB column is plain text, so no
 * migration). Bonus tracking is deliberately deferred; when it lands it will
 * be income, not an expense kind.
 */

export const EXPENSE_KINDS = ['ride', 'meal', 'other'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export type ExpenseMeta = {
  /** Label for menus, badges, and the audit log (e.g. "Ride"). */
  label: string;
  /**
   * Tailwind classes for the kind badge (bg + text + ring). Amber is the
   * ride hue and teal the meal hue — both unclaimed by the leave chips
   * (emerald/rose/violet/sky) and the audit log's indigo.
   */
  badgeClass: string;
};

export const EXPENSE_META: Record<ExpenseKind, ExpenseMeta> = {
  ride: { label: 'Ride', badgeClass: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300' },
  meal: { label: 'Meal', badgeClass: 'bg-teal-500/15 text-teal-700 ring-teal-500/30 dark:text-teal-300' },
  other: { label: 'Other', badgeClass: 'bg-zinc-500/15 text-zinc-700 ring-zinc-500/30 dark:text-zinc-300' },
};

/**
 * Who the money went to, per kind: rides know their ride service, meals
 * their food source. One shared DB column; `KIND_VENDORS` scopes which
 * values each kind accepts (the zod layer scrubs the rest to null).
 */
export const EXPENSE_VENDORS = ['uber', 'lyft', 'uber_eats', 'grubhub', 'restaurant', 'other'] as const;
export type ExpenseVendor = (typeof EXPENSE_VENDORS)[number];
export const VENDOR_LABELS: Record<ExpenseVendor, string> = {
  uber: 'Uber',
  lyft: 'Lyft',
  uber_eats: 'Uber Eats',
  grubhub: 'Grubhub',
  restaurant: 'Restaurant',
  other: 'Other',
};
export const KIND_VENDORS: Record<ExpenseKind, readonly ExpenseVendor[]> = {
  ride: ['uber', 'lyft', 'other'],
  meal: ['uber_eats', 'grubhub', 'restaurant'],
  other: [],
};

/** Ride-only: which leg of the commute. Null on other kinds. */
export const RIDE_DIRECTIONS = ['to_work', 'to_home', 'other'] as const;
export type RideDirection = (typeof RIDE_DIRECTIONS)[number];
export const RIDE_DIRECTION_LABELS: Record<RideDirection, string> = {
  to_work: 'To work',
  to_home: 'To home',
  other: 'Other',
};

/** Meal-only: how the food arrived. Null on other kinds. */
export const MEAL_METHODS = ['delivery', 'pickup'] as const;
export type MealMethod = (typeof MEAL_METHODS)[number];
export const MEAL_METHOD_LABELS: Record<MealMethod, string> = {
  delivery: 'Delivery',
  pickup: 'Pickup',
};
