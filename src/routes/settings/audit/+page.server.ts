import { emptyRepo } from '$lib/core/repo';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import type { PageServerLoad } from './$types';

// On-demand page: unlike the nav tabs this load fetches on navigation, which
// keeps the (potentially large) event list out of the layout payload.
export const load: PageServerLoad = async () => ({
  events: await (isDemo ? emptyRepo : serverRepo).listEntryEvents(),
});
