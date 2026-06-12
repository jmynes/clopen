import { emptyRepo } from '$lib/core/repo';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import type { LayoutServerLoad } from './$types';

// All three pages derive their views from the same entries + settings, loaded
// once here. This load must never read `url`, `params`, or `cookies` — having
// no dependencies is what lets SvelteKit skip the __data.json fetch on every
// client-side navigation, keeping tab switches network-free.
//
// Demo mode never touches the database: SSR serves the defaults stub and the
// browser reloads from localStorage (see +layout.ts).
export const load: LayoutServerLoad = async () => {
  const repo = isDemo ? emptyRepo : serverRepo;
  const [entries, expenses, settings, openShift, savingsGoals] = await Promise.all([
    repo.listEntries(),
    repo.listExpenses(),
    repo.getSettings(),
    repo.getOpenShift(),
    repo.listSavingsGoals(),
  ]);
  return { entries, expenses, settings, openShift, savingsGoals };
};
