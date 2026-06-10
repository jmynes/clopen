import { computeLog } from '$lib/core/log';
import type { PageLoad } from './$types';

// Pure view computation over the layout-loaded data — switching to this tab
// never fetches from the server.
export const load: PageLoad = async ({ parent }) => {
  const { entries, settings } = await parent();
  return computeLog(entries, settings);
};
