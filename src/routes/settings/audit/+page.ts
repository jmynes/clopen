import { browser } from '$app/environment';
import { isDemo } from '$lib/demo/flag';
import type { PageLoad } from './$types';

// Demo mode reads the localStorage audit log; the server load returns the
// stub. timeFormat rides along from the layout's settings for the stamps.
export const load: PageLoad = async ({ data, parent, depends }) => {
  const { settings } = await parent();
  if (!isDemo) return { events: data.events, timeFormat: settings.timeFormat };
  depends('demo:data');
  if (!browser) return { events: data.events, timeFormat: settings.timeFormat };
  const { demoRepo } = await import('$lib/demo/repo');
  return { events: await demoRepo.listEntryEvents(), timeFormat: settings.timeFormat };
};
