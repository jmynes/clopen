import { browser } from '$app/environment';
import { isDemo } from '$lib/demo/flag';
import type { PageLoad } from './$types';

// Demo mode reads the localStorage audit logs; the server load returns the
// stub. timeFormat rides along from the layout's settings for the stamps.
export const load: PageLoad = async ({ data, parent, depends }) => {
  const { settings } = await parent();
  const fromServer = {
    events: data.events,
    expenseEvents: data.expenseEvents,
    bonusEvents: data.bonusEvents,
    timeFormat: settings.timeFormat,
  };
  if (!isDemo) return fromServer;
  depends('demo:data');
  if (!browser) return fromServer;
  const { demoRepo } = await import('$lib/demo/repo');
  const [events, expenseEvents, bonusEvents] = await Promise.all([
    demoRepo.listEntryEvents(),
    demoRepo.listExpenseEvents(),
    demoRepo.listBonusEvents(),
  ]);
  return { events, expenseEvents, bonusEvents, timeFormat: settings.timeFormat };
};
