<script lang="ts">
  import { formatWeekRange } from '$lib/date';
  import type { WeekSummary } from '$lib/timesheet';

  let { weeks }: { weeks: WeekSummary[] } = $props();

  // Scale bars to the tallest of any logged or target value (min 1 to avoid /0).
  const scale = $derived(Math.max(1, ...weeks.flatMap((w) => [w.logged, w.target])));
  const trackHeight = 160;

  function barHeight(value: number): number {
    return Math.round((value / scale) * trackHeight);
  }
</script>

<div class="w-full">
  {#if weeks.length === 0}
    <p class="text-sm text-muted-foreground">No weeks to show yet.</p>
  {:else}
    <div class="flex items-end gap-3 overflow-x-auto pb-2" style="height: {trackHeight + 8}px">
      {#each weeks as week (week.weekStart)}
        {@const met = week.logged >= week.target}
        <div class="group flex min-w-12 flex-1 flex-col items-center justify-end gap-2">
          <div class="relative w-full" style="height: {trackHeight}px">
            <!-- target marker -->
            <div
              class="absolute inset-x-0 border-t-2 border-dashed border-muted-foreground/40"
              style="bottom: {barHeight(week.target)}px"
              title="Target {week.target}h"
            ></div>
            <!-- logged bar -->
            <div
              class="absolute inset-x-1 rounded-t-sm transition-[height] {met ? 'bg-success' : 'bg-amber-500'}"
              style="height: {barHeight(week.logged)}px; bottom: 0"
              title="{week.logged}h logged · {week.target}h target"
            ></div>
            <!-- hover value -->
            <span
              class="absolute inset-x-0 -top-5 text-center text-[11px] font-medium tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
              style="bottom: {barHeight(Math.max(week.logged, week.target)) + 4}px; top: auto"
            >
              {week.logged}h
            </span>
          </div>
          <span class="whitespace-nowrap text-[11px] text-muted-foreground">{formatWeekRange(week.weekStart)}</span>
        </div>
      {/each}
    </div>
    <div class="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-success"></span> Met target</span>
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-amber-500"></span> Below target</span>
      <span class="flex items-center gap-1.5">
        <span class="h-0 w-3.5 border-t-2 border-dashed border-muted-foreground/60"></span> Weekly target
      </span>
    </div>
  {/if}
</div>
