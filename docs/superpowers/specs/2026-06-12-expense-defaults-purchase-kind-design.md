# Expense defaults in Settings · purchase kind · taxi · dine-in

Approved 2026-06-12 (user delegated detail decisions). Builds on the same
day's settings/chart/logos spec.

## Taxonomy (`$lib/expense-kinds.ts`)

- Kinds and vendor lists read **alphabetically with Other pinned last**:
  kinds `meal, purchase, ride, other`; ride vendors `lyft, taxi, uber,
  other`; meal vendors `grubhub, restaurant, uber_eats`; purchase
  categories `hardware, software, subscription, other`.
- New **ride vendor `taxi`** (CarTaxiFront icon, cab-yellow mark).
- New **kind `purchase`** (CreditCard icon, fuchsia badge — the hue no other
  chip claims). Its vendor axis is a category: Hardware (Cpu), Software
  (AppWindow), Subscription (RefreshCw), Other.
- New **meal method `dine_in`** ("Dine-in", ConciergeBell icon).
  `vendorMethods(vendor)` scopes it to the `restaurant` vendor — delivery
  apps keep delivery/pickup. Picking Restaurant defaults the method to
  dine-in; switching away coerces a stranded dine-in to delivery.
- New **`cadence` axis** for subscription purchases: `weekly, monthly,
  quarterly, yearly` (scale-ordered, not alphabetical). Nullable `cadence`
  column on `expenses`; zod scrubs it unless kind=purchase &
  vendor=subscription. Shown as a RefreshCw chip on ledger rows.

## Expense defaults (Settings → new Expenses card)

Seven settings columns, all flowing through zod → server/demo repos →
`computeSettingsPage`/`computeExpenses` → reset-to-defaults:
`defaultExpenseKind` ('ride'), `defaultRideVendor` ('uber'),
`defaultRideDirection` ('to_work'), `defaultMealVendor` ('uber_eats'),
`defaultMealMethod` ('delivery'), `defaultPurchaseVendor` ('hardware'),
`defaultPurchaseCadence` ('monthly').

The Expenses add form opens with the default kind and per-kind details
(`detailDefaults()` now reads settings instead of hardcoding); changing
kind re-seeds the detail axes from the same defaults.

The Settings card has micro-sections New expenses / Ride defaults / Meal
defaults / Purchase defaults; the meal method select is scoped by the
chosen default vendor (dine-in appears only for Restaurant). The settings
grid returns to `lg:grid-cols-3` — five cards, 3+2.

## Done means

check/lint/test clean; route smoke test; committed per area; pushed;
version bumped (minor) and tagged; Railway deploy SUCCESS.
