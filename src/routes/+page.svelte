<script lang="ts">
  import TrendingDown from '@lucide/svelte/icons/trending-down';
  import TrendingUp from '@lucide/svelte/icons/trending-up';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import WeeklyChart from '$lib/components/WeeklyChart.svelte';
  import { formatDay } from '$lib/date';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const status = $derived(data.status);
  const behind = $derived(status.deficit > 0);
  const ahead = $derived(status.surplus > 0);

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const hrs = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}h`;

  const stats = $derived([
    { label: 'Expected', value: hrs(status.expected) },
    { label: 'Logged', value: hrs(status.logged) },
    { label: 'Net', value: `${status.net >= 0 ? '+' : ''}${hrs(status.net)}` },
    { label: 'Baseline', value: `${data.dailyHours}h/day` },
  ]);
</script>

<div class="flex flex-col gap-8">
  <!-- header + as-of picker -->
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="text-sm font-medium uppercase tracking-wider text-muted-foreground">Year to date · {data.year}</p>
      <h1 class="mt-1 text-2xl font-semibold tracking-tight">Am I whole?</h1>
    </div>
    <form method="GET" class="flex flex-col gap-1">
      <label for="asOf" class="text-xs font-medium text-muted-foreground">As of</label>
      <input
        id="asOf"
        type="date"
        name="asOf"
        value={data.asOf}
        min="{data.year}-01-01"
        max={data.today}
        onchange={(e) => e.currentTarget.form?.requestSubmit()}
        class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      />
    </form>
  </div>

  <!-- hero -->
  <Card.Root class="overflow-hidden border-2 {behind ? 'border-amber-500/40' : 'border-success/40'}">
    <Card.Content class="flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {#if behind}
            <TrendingDown class="size-4 text-amber-500" /> Hours to make up
          {:else}
            <TrendingUp class="size-4 text-success" /> You're caught up
          {/if}
        </div>
        <div
          class="mt-2 font-mono text-6xl font-bold tabular-nums tracking-tight {behind
            ? 'text-amber-500'
            : 'text-success'}"
        >
          {behind ? hrs(status.deficit) : ahead ? `+${hrs(status.surplus)}` : '0h'}
        </div>
        <p class="mt-2 max-w-md text-sm text-muted-foreground">
          {#if behind}
            Work {hrs(status.deficit)} more to reach the {hrs(status.expected)} expected by {formatDay(data.asOf)}.
          {:else if ahead}
            {hrs(status.surplus)} banked beyond the {hrs(status.expected)} expected by {formatDay(data.asOf)}.
          {:else}
            Exactly on the {hrs(status.expected)} baseline as of {formatDay(data.asOf)}.
          {/if}
        </p>
      </div>
      <div class="text-right">
        <p class="text-xs uppercase tracking-wider text-muted-foreground">At {money.format(data.hourlyRate)}/h</p>
        <p class="mt-1 font-mono text-2xl font-semibold tabular-nums">
          {money.format(behind ? status.owedDollars : status.surplusDollars)}
        </p>
        <p class="text-xs text-muted-foreground">{behind ? 'still unearned' : 'banked'}</p>
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

  <!-- weekly chart -->
  <Card.Root>
    <Card.Header class="flex flex-row items-center justify-between">
      <div>
        <Card.Title>Weekly hours</Card.Title>
        <Card.Description>Logged vs. target, week by week</Card.Description>
      </div>
      <Badge variant="secondary">{data.weeks.length} weeks</Badge>
    </Card.Header>
    <Card.Content>
      <WeeklyChart weeks={data.weeks} />
    </Card.Content>
  </Card.Root>
</div>
