import { browser } from '$app/environment';
import { loadDashboard } from '$lib/core/dashboard';
import { isDemo } from '$lib/demo/flag';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data, url, depends }) => {
  if (!isDemo) return data;
  depends('demo:data');
  if (!browser) return data;
  const { demoRepo } = await import('$lib/demo/repo');
  return loadDashboard(demoRepo, url.searchParams.get('asOf'));
};
