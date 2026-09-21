import { computeBonuses } from '$lib/core/bonuses';
import type { PageLoad } from './$types';

// Pure view computation over the layout-loaded data — switching to this tab
// never fetches from the server.
export const load: PageLoad = async ({ parent }) => {
  const { bonuses, settings } = await parent();
  return computeBonuses(bonuses, settings);
};
