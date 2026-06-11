import { computeExpenses } from '$lib/core/expenses';
import type { PageLoad } from './$types';

// Pure view computation over the layout-loaded data — switching to this tab
// never fetches from the server.
export const load: PageLoad = async ({ parent }) => {
  const { expenses, settings } = await parent();
  return computeExpenses(expenses, settings);
};
