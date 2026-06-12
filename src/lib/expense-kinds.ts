/**
 * Catalog of expense kinds. Rides (Uber/Lyft) are the founding use case; the
 * taxonomy is the extension point — append a kind here and the schema enum,
 * form select, and badges pick it up (the DB column is plain text, so no
 * migration). Bonus tracking is deliberately deferred; when it lands it will
 * be income, not an expense kind.
 *
 * Ordering convention: kinds and vendor lists read alphabetically with
 * "Other" pinned last.
 */

export const EXPENSE_KINDS = ['meal', 'purchase', 'ride', 'other'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export type ExpenseMeta = {
  /** Label for menus, badges, and the audit log (e.g. "Ride"). */
  label: string;
  /**
   * Tailwind classes for the kind badge (bg + text + ring). Amber is the
   * ride hue, teal the meal hue, fuchsia the purchase hue — all unclaimed
   * by the leave chips (emerald/rose/violet/sky) and the audit log's indigo.
   */
  badgeClass: string;
};

export const EXPENSE_META: Record<ExpenseKind, ExpenseMeta> = {
  meal: { label: 'Meal', badgeClass: 'bg-teal-500/15 text-teal-700 ring-teal-500/30 dark:text-teal-300' },
  purchase: {
    label: 'Purchase',
    badgeClass: 'bg-fuchsia-500/15 text-fuchsia-700 ring-fuchsia-500/30 dark:text-fuchsia-300',
  },
  ride: { label: 'Ride', badgeClass: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300' },
  other: { label: 'Other', badgeClass: 'bg-zinc-500/15 text-zinc-700 ring-zinc-500/30 dark:text-zinc-300' },
};

/**
 * Who the money went to, per kind: rides know their ride service, meals
 * their food source, purchases their category. One shared DB column;
 * `KIND_VENDORS` scopes which values each kind accepts (the zod layer
 * scrubs the rest to null). The per-kind tuples stay literal so zod enums
 * (e.g. the default-vendor settings) can derive from them.
 */
export const RIDE_VENDORS = ['lyft', 'taxi', 'uber', 'other'] as const;
export const MEAL_VENDORS = ['grubhub', 'restaurant', 'uber_eats'] as const;
export const PURCHASE_VENDORS = ['hardware', 'software', 'subscription', 'other'] as const;
export const EXPENSE_VENDORS = [
  'grubhub',
  'hardware',
  'lyft',
  'restaurant',
  'software',
  'subscription',
  'taxi',
  'uber',
  'uber_eats',
  'other',
] as const;
export type ExpenseVendor = (typeof EXPENSE_VENDORS)[number];
export const VENDOR_LABELS: Record<ExpenseVendor, string> = {
  grubhub: 'Grubhub',
  hardware: 'Hardware',
  lyft: 'Lyft',
  restaurant: 'Restaurant',
  software: 'Software',
  subscription: 'Subscription',
  taxi: 'Taxi',
  uber: 'Uber',
  uber_eats: 'Uber Eats',
  other: 'Other',
};
export const KIND_VENDORS: Record<ExpenseKind, readonly ExpenseVendor[]> = {
  meal: MEAL_VENDORS,
  purchase: PURCHASE_VENDORS,
  ride: RIDE_VENDORS,
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
export const MEAL_METHODS = ['delivery', 'pickup', 'dine_in'] as const;
export type MealMethod = (typeof MEAL_METHODS)[number];
export const MEAL_METHOD_LABELS: Record<MealMethod, string> = {
  delivery: 'Delivery',
  pickup: 'Pickup',
  dine_in: 'Dine-in',
};

/** Dine-in only makes sense at an actual restaurant; the apps deliver or hand over a bag. */
export function vendorMethods(vendor: ExpenseVendor | null): readonly MealMethod[] {
  return vendor === 'restaurant' ? MEAL_METHODS : (['delivery', 'pickup'] as const);
}

/**
 * Purchase + subscription only: how often the charge recurs. Null elsewhere.
 * Scale-ordered (not alphabetical) — it's a frequency ladder.
 */
export const PURCHASE_CADENCES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type PurchaseCadence = (typeof PURCHASE_CADENCES)[number];
export const PURCHASE_CADENCE_LABELS: Record<PurchaseCadence, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};
