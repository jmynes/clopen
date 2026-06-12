<script lang="ts">
  import { formatWeekRange } from '$lib/date';
  import type { WeekSummary } from '$lib/timesheet';

  let { weeks }: { weeks: WeekSummary[] } = $props();

  // Scale bars to the tallest of any logged or target value (min 1 to avoid /0).
  const scale = $derived(Math.max(1, ...weeks.flatMap((w) => [w.logged, w.target])));
  const trackHeight = 160;
  // Headroom at the top of the track so the tallest bar's floating hover value
  // never reaches the scroll container's ceiling (overflow-x clips it there).
  const labelRoom = 22;

  // Too many weeks to label every bar — thin to ~13 ticks (roughly monthly).
  const stride = $derived(Math.max(1, Math.ceil(weeks.length / 13)));

  function barHeight(value: number): number {
    return Math.round((value / scale) * (trackHeight - labelRoom));
  }

  // Short axis label: just the week's start ("Jan 05"), not the full range.
  function axisLabel(weekStartISO: string): string {
    return formatWeekRange(weekStartISO).split('–')[0].trim();
  }
</script>

<div class="w-full">
  {#if weeks.length === 0}
    <p class="text-sm text-muted-foreground">No weeks to show yet.</p>
  {:else}
    <div class="flex items-end gap-1.5 overflow-x-auto pb-2 sm:gap-2" style="height: {trackHeight + 28}px">
      {#each weeks as week, i (week.weekStart)}
        {@const met = week.logged >= week.target}
        {@const labelled = i % stride === 0}
        {@const hLogged = barHeight(week.logged)}
        <!-- Overtime cap: the slice of the bar above the target line, floored
             at 2px so a barely-over week still reads as over. -->
        {@const cap = week.logged > week.target ? Math.min(Math.max(hLogged - barHeight(week.target), 2), hLogged) : 0}
        {@const hoverTitle = `${formatWeekRange(week.weekStart, true)} · ${week.logged}h logged · ${week.target}h target`}
        <div class="group flex min-w-7 flex-1 flex-col items-center justify-end gap-2 sm:min-w-9">
          <div class="relative w-full" style="height: {trackHeight}px">
            <!-- target marker -->
            <div
              class="absolute inset-x-0 border-t-2 border-dashed border-muted-foreground/40"
              style="bottom: {barHeight(week.target)}px"
              title="Target {week.target}h"
            ></div>
            <!-- logged bar (up to the target line) -->
            <div
              class="absolute inset-x-0.5 transition-[height] group-hover:brightness-110 {met
                ? 'bg-success'
                : 'bg-amber-500'} {cap === 0 ? 'rounded-t-sm' : ''}"
              style="height: {hLogged - cap}px; bottom: 0"
              title={hoverTitle}
            ></div>
            <!-- overtime above the target line, in the hero's "Beat it" emerald -->
            {#if cap > 0}
              <div
                class="absolute inset-x-0.5 rounded-t-sm bg-emerald-400 transition-[height] group-hover:brightness-110"
                style="height: {cap}px; bottom: {hLogged - cap}px"
                title={hoverTitle}
              ></div>
            {/if}
            <!-- hover value -->
            <span
              class="absolute inset-x-0 text-center text-[11px] font-medium tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
              style="bottom: {barHeight(Math.max(week.logged, week.target)) + 4}px"
            >
              {week.logged}h
            </span>
          </div>
          <!-- thinned axis tick: short label every `stride` weeks, faint tick otherwise.
               Fixed-height row so every bar shares one baseline regardless of label. -->
          <div class="flex h-4 items-start justify-center">
            {#if labelled}
              <span class="whitespace-nowrap text-[11px] leading-4 text-muted-foreground">{axisLabel(week.weekStart)}</span>
            {:else}
              <span class="h-1 w-px bg-border" aria-hidden="true"></span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    <div class="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-emerald-400"></span> Above target</span>
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-success"></span> Met target</span>
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-amber-500"></span> Below target</span>
      <span class="flex items-center gap-1.5">
        <span class="h-0 w-3.5 border-t-2 border-dashed border-muted-foreground/60"></span> Weekly target
      </span>
    </div>
  {/if}
</div>
