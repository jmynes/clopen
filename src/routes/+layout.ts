import { browser } from '$app/environment';
import { isDemo } from '$lib/demo/flag';
import type { LayoutLoad } from './$types';

// Demo mode: the server load returns a defaults stub; once we're in the
// browser, reload everything from the localStorage repo. The root layout
// fires invalidate('demo:data') on mount so the first paint upgrades too.
export const load: LayoutLoad = async ({ data, depends }) => {
  if (!isDemo) return data;
  depends('demo:data');
  if (!browser) return data;
  const { demoRepo } = await import('$lib/demo/repo');
  const [entries, settings] = await Promise.all([demoRepo.listEntries(), demoRepo.getSettings()]);
  return { entries, settings };
};
