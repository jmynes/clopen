import { emptyRepo } from '$lib/core/repo';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import type { PageServerLoad } from './$types';

// On-demand page: unlike the nav tabs this load fetches on navigation, which
// keeps the (potentially large) event lists out of the layout payload.
export const load: PageServerLoad = async () => {
  const repo = isDemo ? emptyRepo : serverRepo;
  const [events, expenseEvents] = await Promise.all([repo.listEntryEvents(), repo.listExpenseEvents()]);
  return { events, expenseEvents };
};
