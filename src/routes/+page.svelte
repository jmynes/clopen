<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Clock from '@lucide/svelte/icons/clock';
  import TrendingDown from '@lucide/svelte/icons/trending-down';
  import TrendingUp from '@lucide/svelte/icons/trending-up';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import WeeklyChart from '$lib/components/WeeklyChart.svelte';
  import { formatDay, formatRangeISO, formatWeekRange, todayISO } from '$lib/date';
  import { addDays, countWorkdays, loggedHours, weekDates } from '$lib/timesheet';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const hrs = (n: number) =>
    `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`;

  // ── Period selector ──────────────────────────────────────────────────────
  type Period = 'week' | 'biweek' | 'month' | 'quarter' | 'year';
  const PERIOD_LABELS: Record<Period, string> = {
    week: 'Weekly',
    biweek: 'Bi-weekly',
    month: 'Monthly',
    quarter: 'Quarterly',
    year: 'Yearly',
  };
  let period = $state<Period>('biweek');
  // Initial-only read of data.today; the anchor mutates independently after first render.
  // svelte-ignore state_referenced_locally
  let anchor = $state(data.today);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function shiftMonth(a: string, n: number): string {
    const [y, m] = a.slice(0, 7).split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return d.toISOString().slice(0, 10);
  }
  function lastDayOf(yearMonth01: string): string {
    const [y, m] = yearMonth01.slice(0, 7).split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  }

  const bucket = $derived.by(() => {
    const wsOn = data.weekStartsOn;
    switch (period) {
      case 'week': {
        const start = weekDates(anchor, wsOn)[0];
        const end = addDays(start, 6);
        return { start, end, label: formatWeekRange(start, true) };
      }
      case 'biweek': {
        const wk = weekDates(anchor, wsOn)[0];
        const start = addDays(wk, -7);
        const end = addDays(wk, 6);
        return { start, end, label: formatRangeISO(start, end, true) };
      }
      case 'month': {
        const start = `${anchor.slice(0, 7)}-01`;
        const end = lastDayOf(start);
        const y = Number(anchor.slice(0, 4));
        return { start, end, label: `${MONTHS[Number(anchor.slice(5, 7)) - 1]} ${y}` };
      }
      case 'quarter': {
        const y = Number(anchor.slice(0, 4));
        const m = Number(anchor.slice(5, 7));
        const qm = Math.floor((m - 1) / 3) * 3 + 1;
        const start = `${y}-${String(qm).padStart(2, '0')}-01`;
        const end = lastDayOf(`${y}-${String(qm + 2).padStart(2, '0')}-01`);
        return { start, end, label: `Q${Math.floor((m - 1) / 3) + 1} ${y}` };
      }
      case 'year': {
        const y = Number(anchor.slice(0, 4));
        return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
      }
    }
  });

  // Effective window: clamp lower bound to epoch (no expected hours before the
  // user started tracking) and upper bound to today (don't accrue expected for
  // days that haven't happened yet, so an in-progress period shows real pace).
  function maxStr(a: string, b: string): string {
    return a > b ? a : b;
  }
  function minStr(a: string, b: string): string {
    return a < b ? a : b;
  }
  const window = $derived.by(() => {
    const lo = maxStr(bucket.start, data.epoch);
    const hi = minStr(bucket.end, data.today);
    return lo > hi ? null : { start: lo, end: hi };
  });

  const expectedHours = $derived(
    window ? countWorkdays(window.start, window.end, data.workdays) * data.dailyHours : 0,
  );
  const inRange = $derived(
    window ? data.entries.filter((e) => e.date >= window.start && e.date <= window.end) : [],
  );
  const logged = $derived(loggedHours(inRange));
  const net = $derived(Math.round((logged - expectedHours) * 100) / 100);

  const expectedDollars = $derived(expectedHours * data.hourlyRate);
  const earnedDollars = $derived(logged * data.hourlyRate);
  const dollarsDelta = $derived(earnedDollars - expectedDollars);

  // Period state: future / in-progress / done.
  const periodState = $derived.by<'future' | 'progress' | 'done'>(() => {
    if (data.today < bucket.start) return 'future';
    if (data.today >= bucket.end) return 'done';
    return 'progress';
  });

  const made = $derived(net >= 0 && periodState === 'done');
  const short = $derived(net < 0 && periodState === 'done');
  const ahead = $derived(net > 0 && periodState === 'progress');
  const behind = $derived(net < 0 && periodState === 'progress');

  // Days elapsed (workdays only) inside the period vs total workdays it has.
  const totalWorkdaysInPeriod = $derived(countWorkdays(bucket.start, bucket.end, data.workdays));
  const workdaysElapsed = $derived(window ? countWorkdays(window.start, window.end, data.workdays) : 0);

  function shiftPage(dir: -1 | 1) {
    switch (period) {
      case 'week':
        anchor = addDays(anchor, 7 * dir);
        return;
      case 'biweek':
        anchor = addDays(anchor, 14 * dir);
        return;
      case 'month':
        anchor = shiftMonth(anchor, dir);
        return;
      case 'quarter':
        anchor = shiftMonth(anchor, 3 * dir);
        return;
      case 'year':
        anchor = shiftMonth(anchor, 12 * dir);
        return;
    }
  }

  // Hero accent color tracks status.
  const accent = $derived(
    made
      ? 'border-success/40'
      : short
        ? 'border-destructive/40'
        : ahead
          ? 'border-success/40'
          : behind
            ? 'border-amber-500/40'
            : 'border-input',
  );

  const subtitle = $derived.by(() => {
    if (periodState === 'future') return `This period hasn't started yet. ${hrs(expectedHours)} expected when it does.`;
    if (periodState === 'done') {
      if (made) return `Logged ${hrs(logged)} against the ${hrs(expectedHours)} target.`;
      return `Short by ${hrs(Math.abs(net))}. Logged ${hrs(logged)} of ${hrs(expectedHours)} target.`;
    }
    return `${hrs(logged)} logged, ${hrs(expectedHours)} expected so far. ${workdaysElapsed} of ${totalWorkdaysInPeriod} workdays elapsed.`;
  });

  const stats = $derived([
    { label: 'Expected', value: hrs(expectedHours) },
    { label: 'Logged', value: hrs(logged) },
    { label: 'Net', value: `${net >= 0 ? '+' : ''}${hrs(net)}` },
    {
      label: periodState === 'done' ? 'Earned' : 'Earned so far',
      value: money.format(earnedDollars),
    },
  ]);
</script>

<div class="flex flex-col gap-8">
  <!-- header -->
  <div>
    <p class="text-sm font-medium uppercase tracking-wider text-muted-foreground">Period status</p>
    <h1 class="mt-1 text-2xl font-semibold tracking-tight">Did I make it?</h1>
  </div>

  <!-- period nav -->
  <div class="flex flex-wrap items-center gap-2 rounded-lg border border-input bg-card p-2">
    <select
      aria-label="Period"
      value={period}
      onchange={(e) => {
        period = e.currentTarget.value as Period;
      }}
      class="h-9 shrink-0 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {#each Object.entries(PERIOD_LABELS) as [v, label] (v)}
        <option value={v}>{label}</option>
      {/each}
    </select>
    <Button variant="outline" size="icon" class="shrink-0" aria-label="Previous period" onclick={() => shiftPage(-1)}>
      <ChevronLeft class="size-4" />
    </Button>
    <span class="flex-1 text-center font-mono text-sm font-medium uppercase tabular-nums">
      {bucket.label}
    </span>
    <Button variant="outline" size="icon" class="shrink-0" aria-label="Next period" onclick={() => shiftPage(1)}>
      <ChevronRight class="size-4" />
    </Button>
    <Button variant="ghost" size="sm" class="shrink-0" onclick={() => (anchor = data.today)}>Today</Button>
  </div>

  <!-- hero -->
  <Card.Root class="overflow-hidden border-2 {accent}">
    <Card.Content class="flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2 text-sm font-medium">
          {#if made}
            <span class="inline-flex items-center gap-1.5 text-success"><Check class="size-4" /> Made it</span>
          {:else if short}
            <span class="inline-flex items-center gap-1.5 text-destructive"><TrendingDown class="size-4" /> Came up short</span>
          {:else if ahead}
            <span class="inline-flex items-center gap-1.5 text-success"><TrendingUp class="size-4" /> Ahead of pace</span>
          {:else if behind}
            <span class="inline-flex items-center gap-1.5 text-amber-500"><TrendingDown class="size-4" /> Behind pace</span>
          {:else if periodState === 'future'}
            <span class="inline-flex items-center gap-1.5 text-muted-foreground"><Clock class="size-4" /> Not started</span>
          {:else}
            <span class="inline-flex items-center gap-1.5 text-muted-foreground"><Check class="size-4" /> On pace</span>
          {/if}
        </div>
        <div
          class="mt-2 font-mono text-6xl font-bold tabular-nums tracking-tight {made || ahead
            ? 'text-success'
            : short
              ? 'text-destructive'
              : behind
                ? 'text-amber-500'
                : 'text-muted-foreground'}"
        >
          {net >= 0 ? '+' : '−'}{hrs(Math.abs(net))}
        </div>
        <p class="mt-2 max-w-md text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div class="text-right">
        <p class="text-xs uppercase tracking-wider text-muted-foreground">
          {periodState === 'done' ? 'Total earned' : 'Earned so far'}
        </p>
        <p
          class="mt-1 font-mono text-2xl font-semibold tabular-nums {dollarsDelta >= 0 ? 'text-success' : 'text-amber-500'}"
        >
          {money.format(earnedDollars)}
        </p>
        <p class="text-xs text-muted-foreground">
          vs. {money.format(expectedDollars)} {periodState === 'done' ? 'target' : 'target so far'}
          {#if dollarsDelta !== 0}
            ·
            <span class={dollarsDelta >= 0 ? 'text-success' : 'text-amber-500'}>
              {dollarsDelta >= 0 ? '+' : '−'}{money.format(Math.abs(dollarsDelta))}
            </span>
          {/if}
        </p>
      </div>
    </Card.Content>
  </Card.Root>

  <!-- stat grid -->
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    {#each stats as stat (stat.label)}
      <Card.Root>
        <Card.Content class="p-5">
          <p class="text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</p>
          <p class="mt-1 font-mono text-xl font-semibold tabular-nums">{stat.value}</p>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>

  <!-- weekly chart (still year-view reference) -->
  <Card.Root>
    <Card.Header class="flex flex-row items-center justify-between">
      <div>
        <Card.Title>Weekly hours · {data.year}</Card.Title>
        <Card.Description>Logged vs. target, week by week</Card.Description>
      </div>
      <Badge variant="secondary">{data.weeks.length} weeks</Badge>
    </Card.Header>
    <Card.Content>
      <WeeklyChart weeks={data.weeks} />
    </Card.Content>
  </Card.Root>
</div>
