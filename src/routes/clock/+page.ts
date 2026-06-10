import { computeClock } from '$lib/core/clock';
import type { PageLoad } from './$types';

// Pure view computation over the layout-loaded data — switching to this tab
// never fetches from the server.
export const load: PageLoad = async ({ parent }) => {
  const { entries, settings, openShift } = await parent();
  return computeClock(entries, settings, openShift);
};
