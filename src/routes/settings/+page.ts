import { computeSettingsPage } from '$lib/core/settings-page';
import type { PageLoad } from './$types';

// Pure view computation over the layout-loaded data — switching to this tab
// never fetches from the server.
export const load: PageLoad = async ({ parent }) => {
  const { settings } = await parent();
  return computeSettingsPage(settings);
};
