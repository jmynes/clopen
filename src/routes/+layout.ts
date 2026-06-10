import { browser } from '$app/environment';
import { isDemo } from '$lib/demo/flag';
import type { LayoutLoad } from './$types';

// Demo mode skips SSR entirely: the server could only render the defaults
// stub (localStorage is unreachable there), so rendering client-side means
// the first paint already shows the visitor's real data — no stub flash.
export const ssr = !isDemo;

// Demo mode: ignore the server's defaults stub and load everything from the
// localStorage repo. With SSR off, the first run already happens in the
// browser, so this is correct from the very first render.
export const load: LayoutLoad = async ({ data, depends }) => {
  if (!isDemo) return data;
  depends('demo:data');
  if (!browser) return data;
  const { demoRepo } = await import('$lib/demo/repo');
  const [entries, settings] = await Promise.all([demoRepo.listEntries(), demoRepo.getSettings()]);
  return { entries, settings };
};
