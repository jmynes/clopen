import { computeDashboard } from '$lib/core/dashboard';
import type { PageLoad } from './$types';

// Pure view computation over the layout-loaded data — switching to this tab
// never fetches from the server. Reading `url` only re-runs this compute when
// ?asOf changes; the layout load is untouched.
export const load: PageLoad = async ({ parent, url }) => {
  const { entries, expenses, settings } = await parent();
  return computeDashboard(entries, expenses, settings, url.searchParams.get('asOf'));
};
