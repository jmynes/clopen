<script lang="ts">
  import { formatRangeISO, formatWeekRange } from '$lib/date';
  import type { BucketGranularity, BucketSummary } from '$lib/timesheet';

  let { buckets, granularity }: { buckets: BucketSummary[]; granularity: BucketGranularity } = $props();

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Scale bars to the tallest of any logged or target value (min 1 to avoid /0).
  const scale = $derived(Math.max(1, ...buckets.flatMap((b) => [b.logged, b.target])));
  const trackHeight = 160;
  // Headroom at the top of the track so the tallest bar's floating hover value
  // never reaches the scroll container's ceiling (overflow-x clips it there).
  const labelRoom = 22;

  // Too many buckets to label every bar — thin to ~13 ticks.
  const stride = $derived(Math.max(1, Math.ceil(buckets.length / 13)));

  function barHeight(value: number): number {
    return Math.round((value / scale) * (trackHeight - labelRoom));
  }

  // Y-axis gridlines at "nice" hour steps, at most ~4 lines below the scale.
  const STEPS = [1, 2, 4, 5, 10, 20, 40, 50, 100, 200, 400, 500, 1000, 2000];
  const yStep = $derived(STEPS.find((s) => scale / s <= 4) ?? 4000);
  const yTicks = $derived(Array.from({ length: Math.floor(scale / yStep) }, (_, i) => (i + 1) * yStep));

  function axisLabel(b: BucketSummary): string {
    switch (granularity) {
      case 'day':
      case 'week':
      case 'biweek':
        // "Jan 05" — the bucket's start day.
        return formatWeekRange(b.start).split('–')[0].trim();
      case 'month':
        return MONTHS[Number(b.start.slice(5, 7)) - 1];
      case 'quarter':
        return `Q${Math.floor((Number(b.start.slice(5, 7)) - 1) / 3) + 1}`;
      case 'year':
        return b.start.slice(0, 4);
    }
  }

  function hoverLabel(b: BucketSummary): string {
    if (granularity === 'day') return formatRangeISO(b.start, b.start, true).split('–')[0].trim();
    return formatRangeISO(b.start, b.end, true);
  }
</script>

<div class="w-full">
  {#if buckets.length === 0}
    <p class="text-sm text-muted-foreground">Nothing to show yet.</p>
  {:else}
    <div class="flex gap-2">
      <!-- y axis: hour labels aligned to the gridlines, 0 at the baseline -->
      <div
        class="relative w-7 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground"
        style="height: {trackHeight + 28}px"
        aria-hidden="true"
      >
        {#each yTicks as tick (tick)}
          <span class="absolute right-0 -translate-y-1/2" style="top: {trackHeight - barHeight(tick)}px">{tick}h</span>
        {/each}
        <span class="absolute right-0 -translate-y-1/2" style="top: {trackHeight}px">0h</span>
      </div>
      <div class="relative min-w-0 flex-1">
        <!-- gridlines span the full plot behind the bars -->
        <div class="pointer-events-none absolute inset-x-0" style="height: {trackHeight}px" aria-hidden="true">
          {#each yTicks as tick (tick)}
            <div class="absolute inset-x-0 border-t border-border/50" style="bottom: {barHeight(tick)}px"></div>
          {/each}
          <div class="absolute inset-x-0 bottom-0 border-t border-border"></div>
        </div>
        <div class="flex items-end gap-1.5 overflow-x-auto pb-2 sm:gap-2" style="height: {trackHeight + 28}px">
          {#each buckets as bucket, i (bucket.start)}
            {@const met = bucket.logged >= bucket.target}
            {@const labelled = i % stride === 0}
            {@const hLogged = barHeight(bucket.logged)}
            <!-- Overtime cap: the slice of the bar above the target line, floored
                 at 2px so a barely-over bucket still reads as over. -->
            {@const cap =
              bucket.logged > bucket.target ? Math.min(Math.max(hLogged - barHeight(bucket.target), 2), hLogged) : 0}
            {@const hoverTitle = `${hoverLabel(bucket)} · ${bucket.logged}h logged · ${bucket.target}h target`}
            <div class="group flex min-w-7 flex-1 flex-col items-center justify-end gap-2 sm:min-w-9">
              <div class="relative w-full" style="height: {trackHeight}px">
                <!-- target marker -->
                <div
                  class="absolute inset-x-0 border-t-2 border-dashed border-muted-foreground/40"
                  style="bottom: {barHeight(bucket.target)}px"
                  title="Target {bucket.target}h"
                ></div>
                <!-- logged bar (up to the target line) -->
                <div
                  class="absolute inset-x-0.5 transition-[height] group-hover:brightness-110 {met
                    ? 'bg-success'
                    : 'bg-rose-500 dark:bg-rose-400'} {cap === 0 ? 'rounded-t-sm' : ''}"
                  style="height: {hLogged - cap}px; bottom: 0"
                  title={hoverTitle}
                ></div>
                <!-- overtime above the target line — the same blue as savings-goal bars -->
                {#if cap > 0}
                  <div
                    class="absolute inset-x-0.5 rounded-t-sm bg-blue-600 transition-[height] group-hover:brightness-110 dark:bg-blue-400"
                    style="height: {cap}px; bottom: {hLogged - cap}px"
                    title={hoverTitle}
                  ></div>
                {/if}
                <!-- hover value -->
                <span
                  class="absolute inset-x-0 text-center text-[11px] font-medium tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
                  style="bottom: {barHeight(Math.max(bucket.logged, bucket.target)) + 4}px"
                >
                  {bucket.logged}h
                </span>
              </div>
              <!-- thinned axis tick: short label every `stride` buckets, faint tick otherwise.
                   Fixed-height row so every bar shares one baseline regardless of label. -->
              <div class="flex h-4 items-start justify-center">
                {#if labelled}
                  <span class="whitespace-nowrap text-[11px] leading-4 text-muted-foreground">{axisLabel(bucket)}</span>
                {:else}
                  <span class="h-1 w-px bg-border" aria-hidden="true"></span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-blue-600 dark:bg-blue-400"></span> Above target</span>
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-success"></span> Met target</span>
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-rose-500 dark:bg-rose-400"></span> Below target</span>
      <span class="flex items-center gap-1.5">
        <span class="h-0 w-3.5 border-t-2 border-dashed border-muted-foreground/60"></span> Target
      </span>
    </div>
  {/if}
</div>
