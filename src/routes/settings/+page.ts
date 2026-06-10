import { browser } from '$app/environment';
import { loadSettingsPage } from '$lib/core/settings-page';
import { isDemo } from '$lib/demo/flag';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data, depends }) => {
  if (!isDemo) return data;
  depends('demo:data');
  if (!browser) return data;
  const { demoRepo } = await import('$lib/demo/repo');
  return loadSettingsPage(demoRepo);
};
