import { browser } from '$app/environment';
import { loadLog } from '$lib/core/log';
import { isDemo } from '$lib/demo/flag';
import type { PageLoad } from './$types';

// Demo mode: the server load returns a defaults stub; once we're in the
// browser, recompute everything from the localStorage repo. The root layout
// fires invalidate('demo:data') on mount so the first paint upgrades too.
export const load: PageLoad = async ({ data, depends }) => {
  if (!isDemo) return data;
  depends('demo:data');
  if (!browser) return data;
  const { demoRepo } = await import('$lib/demo/repo');
  return loadLog(demoRepo);
};
