<script lang="ts">
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import Clock from '@lucide/svelte/icons/clock';
  import Pencil from '@lucide/svelte/icons/pencil';
  import PiggyBank from '@lucide/svelte/icons/piggy-bank';
  import Plus from '@lucide/svelte/icons/plus';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import TrendingDown from '@lucide/svelte/icons/trending-down';
  import TrendingUp from '@lucide/svelte/icons/trending-up';
  import Wallet from '@lucide/svelte/icons/wallet';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import DateField from '$lib/components/DateField.svelte';
  import DateJump from '$lib/components/DateJump.svelte';
  import HoursChart from '$lib/components/HoursChart.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { runSavingsGoalAction, type SavingsGoalActionName } from '$lib/core/savings-goals';
  import { formatDay, formatRangeISO, formatWeekRange, todayISO } from '$lib/date';
  import type { SavingsGoal } from '$lib/db/schema';
  import { isDemo } from '$lib/demo/flag';
  import { allocateGoals, GOAL_FUNDING_LABELS, GOAL_FUNDINGS, type GoalFunding } from '$lib/savings-goals';
  import {
    addDays,
    type BucketGranularity,
    bucketBreakdown,
    countWorkdays,
    goalRateOf,
    loggedHours,
    overtimeHours,
    weekDates,
  } from '$lib/timesheet';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Demo mode intercepts mutations client-side; results stand in for `form`.
  let demoForm = $state<ActionData>(null);
  const actionData = $derived(isDemo ? demoForm : form);

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
  // The pay cycle decides what the dashboard opens to; the selectors still
  // change it per visit. Daily pay has no hero period, so it opens weekly.
  const CYCLE_PERIOD: Record<typeof data.payCycle, Period> = {
    daily: 'week',
    weekly: 'week',
    biweekly: 'biweek',
    monthly: 'month',
  };
  // Initial-only read; the selector mutates independently after first render.
  // svelte-ignore state_referenced_locally
  let period = $state<Period>(CYCLE_PERIOD[data.payCycle]);
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

  // ── Goal + expenses fold into the target ─────────────────────────────────
  // Whether expenses in the window count toward the make-whole math. Starts
  // from the setting; flipping the hero toggle is per-visit only.
  // svelte-ignore state_referenced_locally
  let includeExpenses = $state(data.countExpenses);
  const expensesInRange = $derived(
    window ? data.expenses.filter((e) => e.date >= window.start && e.date <= window.end) : [],
  );
  const expensesTotal = $derived(Math.round(expensesInRange.reduce((s, e) => s + e.amount, 0) * 100) / 100);
  const includedExpenses = $derived(includeExpenses ? expensesTotal : 0);

  // A yearly goal swaps the salary rate for the rate the goal implies given
  // the bucket's year, so every period's dollar target prorates the stretch.
  const targetRate = $derived(
    data.goalEnabled
      ? goalRateOf(data.yearlyGoal, Number(bucket.start.slice(0, 4)), data.dailyHours, data.workdays)
      : data.hourlyRate,
  );
  const expectedDollars = $derived(expectedHours * targetRate + includedExpenses);

  // Hours owed are money-driven: the goal stretch and included expenses both
  // convert to hours at the straight rate. With goal off and no expenses this
  // reduces exactly to the schedule's expected hours.
  const targetHours = $derived(
    data.hourlyRate > 0 ? Math.round((expectedDollars / data.hourlyRate) * 100) / 100 : expectedHours,
  );
  const net = $derived(Math.round((logged - targetHours) * 100) / 100);
  // Day-hours beyond the baseline earn at the multiplier when enabled;
  // otherwise everything is straight time (overtime still banks either way).
  const otHours = $derived(data.otMultiplierEnabled ? overtimeHours(inRange, data.dailyHours) : 0);
  const earnedDollars = $derived(
    (logged - otHours) * data.hourlyRate + otHours * data.hourlyRate * data.otMultiplier,
  );
  const dollarsDelta = $derived(earnedDollars - expectedDollars);

  // Period state: future / in-progress / done.
  const periodState = $derived.by<'future' | 'progress' | 'done'>(() => {
    if (data.today < bucket.start) return 'future';
    if (data.today >= bucket.end) return 'done';
    return 'progress';
  });

  // Done states: exactly even (made), positive (beat — overtime banked), negative (short).
  const made = $derived(net === 0 && periodState === 'done');
  const beat = $derived(net > 0 && periodState === 'done');
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
    beat
      ? 'border-emerald-500/50'
      : made
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
    if (periodState === 'future') return `This period hasn't started yet. ${hrs(targetHours)} expected when it does.`;
    if (periodState === 'done') {
      if (beat) return `Logged ${hrs(logged)} against the ${hrs(targetHours)} target — +${hrs(net)} overtime banked.`;
      if (made) return `Logged ${hrs(logged)} against the ${hrs(targetHours)} target.`;
      return `Short by ${hrs(Math.abs(net))}. Logged ${hrs(logged)} of ${hrs(targetHours)} target.`;
    }
    return `${hrs(logged)} logged, ${hrs(targetHours)} expected so far. ${workdaysElapsed} of ${totalWorkdaysInPeriod} workdays elapsed.`;
  });

  // ── Hours chart ──────────────────────────────────────────────────────────
  const GRANULARITY_LABELS: Record<BucketGranularity, string> = {
    day: 'Daily',
    week: 'Weekly',
    biweek: 'Bi-weekly',
    month: 'Monthly',
    quarter: 'Quarterly',
    year: 'Yearly',
  };
  const CYCLE_GRANULARITY: Record<typeof data.payCycle, BucketGranularity> = {
    daily: 'day',
    weekly: 'week',
    biweekly: 'biweek',
    monthly: 'month',
  };
  // Initial-only read; the select mutates independently after first render.
  // svelte-ignore state_referenced_locally
  let chartGranularity = $state<BucketGranularity>(CYCLE_GRANULARITY[data.payCycle]);
  const chartBuckets = $derived(
    bucketBreakdown({
      entries: data.entries,
      rangeStart: maxStr(`${data.year}-01-01`, data.epoch),
      asOf: data.asOf,
      settings: { hourlyRate: data.hourlyRate, dailyHours: data.dailyHours, workdays: data.workdays },
      weekStartsOn: data.weekStartsOn,
      granularity: chartGranularity,
    }),
  );

  // ── Savings goals ────────────────────────────────────────────────────────
  // Independent of the period selector and of the yearly stretch goal: goals
  // accumulate from their own start dates through today at the straight
  // salary rate, split by allocation in rank order — spare share from goals
  // already reached tops up the highest-ranked unfinished goal.
  const goalCards = $derived.by(() => {
    const progress = allocateGoals({
      goals: data.savingsGoals,
      entries: data.entries,
      asOf: data.today,
      settings: { hourlyRate: data.hourlyRate, dailyHours: data.dailyHours, workdays: data.workdays },
      epoch: data.epoch,
      otMultiplierEnabled: data.otMultiplierEnabled,
      otMultiplier: data.otMultiplier,
    });
    return data.savingsGoals.map((goal, i) => ({ goal, progress: progress[i] }));
  });

  const goalDateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
  const fmtGoalDate = (iso: string) => goalDateFmt.format(new Date(`${iso}T00:00:00Z`));

  const FUNDING_ICON = { overtime: Sparkles, all: Wallet } as const;
  const FUNDING_HINT: Record<GoalFunding, string> = {
    overtime: 'Dollars earned beyond your schedule since the start date',
    all: 'Every dollar earned since the start date',
  };

  // One-tap "counting from" picks; DateField clamps them to the epoch floor.
  const goalDateShortcuts = $derived.by(() => {
    const m = Number(data.today.slice(5, 7));
    const qm = String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0');
    return [
      { label: 'Today', value: data.today },
      { label: 'This week', value: weekDates(data.today, data.weekStartsOn)[0] },
      { label: 'This month', value: `${data.today.slice(0, 7)}-01` },
      { label: 'This quarter', value: `${data.today.slice(0, 4)}-${qm}-01` },
      { label: 'This year', value: `${data.today.slice(0, 4)}-01-01` },
    ];
  });

  // null = closed; id null = adding, otherwise editing that goal.
  let goalDialog = $state<{ id: string | null } | null>(null);
  let gName = $state('');
  let gTarget = $state('');
  let gStart = $state('');
  let gFunding = $state<GoalFunding>('overtime');
  let gAllocation = $state('100');
  let deletingGoal = $state<SavingsGoal | null>(null);
  let goalSubmitting = $state(false);

  function openGoalDialog(goal?: SavingsGoal) {
    gName = goal?.name ?? '';
    gTarget = goal ? String(goal.targetAmount) : '';
    gStart = goal?.startDate ?? data.today;
    gFunding = goal?.funding ?? 'overtime';
    gAllocation = String(goal?.allocation ?? 100);
    demoForm = null;
    goalDialog = { id: goal?.id ?? null };
  }

  // Shared enhance: demo cancels the POST and runs the core action against
  // localStorage; normal mode submits and invalidateAll() refreshes the layout.
  function goalEnhance(action: SavingsGoalActionName, after?: () => void): SubmitFunction {
    return ({ formData, cancel }) => {
      goalSubmitting = true;
      if (isDemo) {
        cancel();
        void (async () => {
          const { demoRepo } = await import('$lib/demo/repo');
          const out = await runSavingsGoalAction(demoRepo, action, formData);
          demoForm = out.data as ActionData;
          if (out.ok) after?.();
          await invalidate('demo:data');
          goalSubmitting = false;
        })();
        return;
      }
      return async ({ result, update }) => {
        await update();
        if (result.type === 'success') after?.();
        goalSubmitting = false;
      };
    };
  }

  // Only the numbers carry color, and only when it means something:
  // Net and Earned mirror the hero's ahead/behind hues; the rest stay plain.
  const stats = $derived([
    { label: 'Expected', value: hrs(targetHours), icon: CalendarCheck, valueClass: '' },
    { label: 'Logged', value: hrs(logged), icon: Clock, valueClass: '' },
    {
      label: 'Net',
      value: `${net >= 0 ? '+' : ''}${hrs(net)}`,
      icon: net >= 0 ? TrendingUp : TrendingDown,
      valueClass:
        net >= 0 ? 'text-success' : periodState === 'done' ? 'text-destructive' : 'text-amber-500',
    },
    {
      // The dollar twin of Net: signed distance from the period's dollar
      // target, titled by which side of it the period sits on.
      label: dollarsDelta >= 0 ? 'Surplus' : 'Deficit',
      value: `${dollarsDelta >= 0 ? '+' : '−'}${money.format(Math.abs(dollarsDelta))}`,
      icon: Wallet,
      valueClass:
        dollarsDelta >= 0 ? 'text-success' : periodState === 'done' ? 'text-destructive' : 'text-amber-500',
    },
  ]);
</script>

<div class="flex flex-col gap-8">
  <!-- header -->
  <div class="max-md:text-center">
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
      class="h-9 shrink-0 basis-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:basis-auto"
    >
      {#each Object.entries(PERIOD_LABELS) as [v, label] (v)}
        <option value={v}>{label}</option>
      {/each}
    </select>
    <Button variant="outline" size="icon-lg" class="shrink-0" title="Previous period" aria-label="Previous period" onclick={() => shiftPage(-1)}>
      <ChevronLeft class="size-4" />
    </Button>
    <span class="flex-1 text-center font-mono text-sm font-medium uppercase tabular-nums">
      {bucket.label}
    </span>
    <Button variant="outline" size="icon-lg" class="shrink-0" title="Next period" aria-label="Next period" onclick={() => shiftPage(1)}>
      <ChevronRight class="size-4" />
    </Button>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline" size="lg" class="shrink-0" onclick={() => (anchor = data.today)}>
            <CalendarCheck class="size-4" /> Today
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>Jump back to the current period</Tooltip.Content>
    </Tooltip.Root>
    <DateJump
      value={anchor}
      min={data.epoch}
      label="Jump to date"
      onpick={(iso) => (anchor = iso < data.epoch ? data.epoch : iso)}
    />
  </div>

  <!-- hero -->
  <Card.Root class="overflow-hidden border-2 {accent}">
    <Card.Content class="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
      <div class="max-md:text-center">
        <div class="flex items-center gap-2 text-sm font-medium max-md:justify-center">
          {#if beat}
            <span class="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Sparkles class="size-4" /> Beat it · overtime banked
            </span>
          {:else if made}
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
          class="mt-2 font-mono text-5xl font-bold tabular-nums tracking-tight md:text-6xl {beat || made || ahead
            ? 'text-success'
            : short
              ? 'text-destructive'
              : behind
                ? 'text-amber-500'
                : 'text-muted-foreground'}"
        >
          {net >= 0 ? '+' : '−'}{hrs(Math.abs(net))}
        </div>
        <p class="mt-2 max-w-md text-sm text-muted-foreground max-md:mx-auto">{subtitle}</p>
      </div>
      <div class="border-t border-border/60 pt-4 max-md:text-center md:border-t-0 md:pt-0 md:text-right">
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
        {#if expensesTotal > 0}
          <label
            class="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-2.5 py-1.5 text-xs transition-colors has-checked:border-amber-500/60 has-checked:bg-amber-500/10"
          >
            <input type="checkbox" bind:checked={includeExpenses} class="accent-amber-500" />
            <span>Include {money.format(expensesTotal)} expenses</span>
          </label>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- stat grid -->
  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    {#each stats as stat (stat.label)}
      {@const StatIcon = stat.icon}
      <Card.Root>
        <Card.Content class="p-5">
          <p class="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <StatIcon class="size-3.5 shrink-0 text-foreground" />
            {stat.label}
          </p>
          <p class="mt-1 font-mono text-xl font-semibold tabular-nums {stat.valueClass}">{stat.value}</p>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>

  <!-- savings goals -->
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm font-medium uppercase tracking-wider text-muted-foreground">Savings goals</p>
      {#if goalCards.length > 0}
        <Button variant="outline" size="sm" onclick={() => openGoalDialog()}>
          <Plus class="size-4" /> Add goal
        </Button>
      {/if}
    </div>
    {#if goalCards.length === 0}
      <Card.Root class="border-dashed">
        <Card.Content
          class="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left"
        >
          <div class="flex items-center gap-3 max-sm:flex-col">
            <PiggyBank class="size-5 shrink-0 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">
              Put your banked overtime toward something — a Switch, a trip, a rainy-day fund.
            </p>
          </div>
          <Button variant="outline" size="sm" class="shrink-0" onclick={() => openGoalDialog()}>
            <Plus class="size-4" /> Add goal
          </Button>
        </Card.Content>
      </Card.Root>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each goalCards as { goal, progress }, rankIdx (goal.id)}
          {@const FundingIcon = FUNDING_ICON[goal.funding]}
          <Card.Root class={progress.reached ? 'border-success/50' : ''}>
            <Card.Content class="flex flex-col gap-3 p-5">
              <!-- header strip: rank + funding chip left, actions right -->
              <div class="-mt-1 flex items-center justify-between gap-1">
                <span class="flex min-w-0 items-center gap-1.5">
                  <Badge variant="secondary" class="px-1.5 font-mono text-[11px] tabular-nums">#{rankIdx + 1}</Badge>
                  <Badge
                    variant="outline"
                    class="gap-1.5 font-normal text-muted-foreground"
                    title={FUNDING_HINT[goal.funding]}
                  >
                    <FundingIcon class="size-3.5" />
                    {GOAL_FUNDING_LABELS[goal.funding]}
                  </Badge>
                </span>
                <span class="-mr-2 flex shrink-0">
                  {#if goalCards.length > 1}
                    <form method="POST" action="?/moveGoal" use:enhance={goalEnhance('moveGoal')} class="contents">
                      <input type="hidden" name="id" value={goal.id} />
                      <input type="hidden" name="dir" value="up" />
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              type="submit"
                              variant="ghost"
                              size="sm"
                              aria-label="Increase priority"
                              disabled={rankIdx === 0 || goalSubmitting}
                            >
                              <ChevronUp class="size-4" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>Increase priority</Tooltip.Content>
                      </Tooltip.Root>
                    </form>
                    <form method="POST" action="?/moveGoal" use:enhance={goalEnhance('moveGoal')} class="contents">
                      <input type="hidden" name="id" value={goal.id} />
                      <input type="hidden" name="dir" value="down" />
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              type="submit"
                              variant="ghost"
                              size="sm"
                              aria-label="Decrease priority"
                              disabled={rankIdx === goalCards.length - 1 || goalSubmitting}
                            >
                              <ChevronDown class="size-4" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>Decrease priority</Tooltip.Content>
                      </Tooltip.Root>
                    </form>
                  {/if}
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      {#snippet child({ props })}
                        <Button {...props} variant="ghost" size="sm" aria-label="Edit goal" onclick={() => openGoalDialog(goal)}>
                          <Pencil class="size-4" />
                        </Button>
                      {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content>Edit goal</Tooltip.Content>
                  </Tooltip.Root>
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      {#snippet child({ props })}
                        <Button
                          {...props}
                          variant="ghost"
                          size="sm"
                          aria-label="Delete goal"
                          class="text-destructive hover:text-destructive"
                          onclick={() => (deletingGoal = goal)}
                        >
                          <Trash2 class="size-4" />
                        </Button>
                      {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content>Delete goal</Tooltip.Content>
                  </Tooltip.Root>
                </span>
              </div>
              <div class="min-w-0">
                <p class="truncate font-medium" title={goal.name}>{goal.name}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {(goalCards.length > 1 ? `${goal.allocation}% share · ` : '') +
                    (goal.startDate > data.today
                      ? `starts ${fmtGoalDate(goal.startDate)}`
                      : `since ${fmtGoalDate(goal.startDate)}`)}
                </p>
              </div>
              <div
                class="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="{goal.name} progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.floor(progress.pct))}
              >
                <div
                  class="h-full rounded-full transition-[width] {progress.reached
                    ? 'bg-success'
                    : 'bg-blue-600 dark:bg-blue-400'}"
                  style="width: {Math.min(100, progress.pct)}%"
                ></div>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <p class="font-mono text-sm tabular-nums">
                  <span class="font-semibold">{money.format(progress.saved)}</span>
                  <span class="text-muted-foreground">of {money.format(goal.targetAmount)}</span>
                </p>
                {#if progress.reached}
                  <span class="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <Check class="size-3.5" /> Reached
                  </span>
                {:else}
                  <span class="font-mono text-xs tabular-nums text-muted-foreground">{Math.floor(progress.pct)}%</span>
                {/if}
              </div>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    {/if}
  </div>

  <!-- hours chart (still year-view reference; granularity is per-visit) -->
  <Card.Root>
    <Card.Header class="flex flex-row flex-wrap items-center justify-between gap-2">
      <div>
        <Card.Title>{GRANULARITY_LABELS[chartGranularity]} hours · {data.year}</Card.Title>
        <Card.Description>Logged vs. target, {GRANULARITY_LABELS[chartGranularity].toLowerCase()}</Card.Description>
      </div>
      <div class="flex items-center gap-2">
        <select
          aria-label="Chart granularity"
          value={chartGranularity}
          onchange={(e) => {
            chartGranularity = e.currentTarget.value as BucketGranularity;
          }}
          class="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {#each Object.entries(GRANULARITY_LABELS) as [v, label] (v)}
            <option value={v}>{label}</option>
          {/each}
        </select>
        <Badge variant="secondary">{chartBuckets.length}</Badge>
      </div>
    </Card.Header>
    <Card.Content>
      <HoursChart buckets={chartBuckets} granularity={chartGranularity} />
    </Card.Content>
  </Card.Root>
</div>

<!-- add / edit goal dialog -->
<Dialog.Root
  open={goalDialog !== null}
  onOpenChange={(o) => {
    if (!o) goalDialog = null;
  }}
>
  <Dialog.Content class="sm:max-w-md">
    {#if goalDialog}
      <Dialog.Header>
        <Dialog.Title>{goalDialog.id ? 'Edit goal' : 'Add a savings goal'}</Dialog.Title>
        <Dialog.Description>
          A dollar target tracked beside — never instead of — your salary math.
        </Dialog.Description>
      </Dialog.Header>
      <form
        method="POST"
        action={goalDialog.id ? '?/updateGoal' : '?/addGoal'}
        use:enhance={goalEnhance(goalDialog.id ? 'updateGoal' : 'addGoal', () => (goalDialog = null))}
        class="flex flex-col gap-4"
      >
        {#if goalDialog.id}
          <input type="hidden" name="id" value={goalDialog.id} />
        {/if}
        <div class="flex flex-col gap-1.5">
          <Label for="goal-name">Name</Label>
          <Input
            id="goal-name"
            type="text"
            name="name"
            placeholder="Nintendo Switch"
            maxlength={80}
            bind:value={gName}
            required
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="goal-target">Target (USD)</Label>
          <Input id="goal-target" type="number" name="targetAmount" step="0.01" min="0.01" bind:value={gTarget} required />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="goal-start">Counting from</Label>
          <DateField id="goal-start" name="startDate" bind:value={gStart} min={data.epoch} shortcuts={goalDateShortcuts} />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="goal-allocation">Allocation (%)</Label>
          <Input
            id="goal-allocation"
            type="number"
            name="allocation"
            step="1"
            min="0"
            max="100"
            bind:value={gAllocation}
            required
          />
          <p class="text-xs text-muted-foreground">
            This goal's share of new savings. Spare share from goals already reached tops up the highest-ranked
            unfinished goal.
          </p>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="goal-funding">Funded by</Label>
          <Select.Root type="single" value={gFunding} onValueChange={(v) => (gFunding = v as GoalFunding)}>
            <Select.Trigger id="goal-funding" aria-label="Funded by" class="w-full">
              {@const TriggerIcon = FUNDING_ICON[gFunding]}
              <span class="inline-flex min-w-0 items-center gap-1.5">
                <TriggerIcon class="size-3.5 shrink-0" />
                <span class="min-w-0 truncate text-xs">{GOAL_FUNDING_LABELS[gFunding]}</span>
              </span>
            </Select.Trigger>
            <Select.Content>
              {#each GOAL_FUNDINGS as funding (funding)}
                {@const ItemIcon = FUNDING_ICON[funding]}
                <Select.Item value={funding} label={GOAL_FUNDING_LABELS[funding]}>
                  <span class="inline-flex items-center gap-2">
                    <ItemIcon class="size-3.5" />
                    <span>
                      {GOAL_FUNDING_LABELS[funding]}
                      <span class="block text-xs text-muted-foreground">{FUNDING_HINT[funding]}</span>
                    </span>
                  </span>
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <input type="hidden" name="funding" value={gFunding} />
        </div>
        {#if actionData && 'goalError' in actionData && actionData.goalError}
          <p class="text-sm text-destructive">{actionData.goalError}</p>
        {/if}
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (goalDialog = null)}>Cancel</Button>
          <Button type="submit" disabled={goalSubmitting}>{goalDialog.id ? 'Save' : 'Add goal'}</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- delete goal confirm -->
<Dialog.Root
  open={deletingGoal !== null}
  onOpenChange={(o) => {
    if (!o) deletingGoal = null;
  }}
>
  <Dialog.Content class="sm:max-w-md">
    {#if deletingGoal}
      <Dialog.Header>
        <Dialog.Title>Delete this goal?</Dialog.Title>
        <Dialog.Description>
          {deletingGoal.name} · {money.format(deletingGoal.targetAmount)} · {GOAL_FUNDING_LABELS[deletingGoal.funding]}
        </Dialog.Description>
      </Dialog.Header>
      <form method="POST" action="?/deleteGoal" use:enhance={goalEnhance('deleteGoal', () => (deletingGoal = null))}>
        <input type="hidden" name="id" value={deletingGoal.id} />
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (deletingGoal = null)}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={goalSubmitting}>Delete</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>
