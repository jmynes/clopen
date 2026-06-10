<script lang="ts">
  import type { SubmitFunction } from '@sveltejs/kit';
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import DateField from '$lib/components/DateField.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { adjustStart, clockIn, clockOut, endBreak, resolveDiscard, resolveSave, startBreak } from '$lib/core/clock';
  import type { ActionOutcome } from '$lib/core/log';
  import type { Repo } from '$lib/core/repo';
  import { formatDay, formatTime, formatTimeRange, zonedParts, zonedToMs } from '$lib/date';
  import { isDemo } from '$lib/demo/flag';
  import { parseTimeInput } from '$lib/timesheet';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Demo mode intercepts the punch client-side; results stand in for `form`.
  let demoForm = $state<ActionData>(null);
  const actionData = $derived(isDemo ? demoForm : form);
  const errorMsg = $derived(actionData && 'error' in actionData ? String(actionData.error) : null);

  // One ticking interval drives every live readout on the page.
  let nowMs = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
    return () => clearInterval(id);
  });

  const shift = $derived(data.openShift);
  // Worked ms in the running shift; frozen at the break start while on break.
  const workedMs = $derived.by(() => {
    if (!shift || shift.startedAt == null) return 0;
    const end = shift.breakStartedAt ?? nowMs;
    return Math.max(0, end - shift.startedAt - shift.breakSeconds * 1000);
  });
  const breakMs = $derived(shift?.breakStartedAt != null ? Math.max(0, nowMs - shift.breakStartedAt) : 0);

  function fmtElapsed(ms: number): string {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  const hrs = (n: number) => `${n.toFixed(2)}h`;
  const sinceLabel = $derived(
    shift?.startedAt != null ? formatTime(zonedParts(shift.startedAt).hhmm, data.timeFormat) : '',
  );
  const breakSinceLabel = $derived(
    shift?.breakStartedAt != null ? formatTime(zonedParts(shift.breakStartedAt).hhmm, data.timeFormat) : '',
  );
  const startedDate = $derived(shift?.startedAt != null ? zonedParts(shift.startedAt).date : data.today);
  // Stale punches may sit on a break (split mode: startedAt null), so the
  // banner falls back to the break start as "since when".
  const staleLabel = $derived.by(() => {
    const ms = shift?.startedAt ?? shift?.breakStartedAt;
    if (ms == null) return '';
    const p = zonedParts(ms);
    return `${formatDay(p.date)} ${formatTime(p.hhmm, data.timeFormat)}`;
  });

  const timePlaceholder = $derived(data.timeFormat === '24h' ? '17:30' : '05:30 PM');

  // Every punch mutates the same single open-shift row, so one in-flight flag
  // disables all punch buttons — double-clicks can't race the state machine.
  let submitting = $state(false);

  // Shared enhance: demo cancels the POST and runs the matching core action
  // against localStorage (the layout's demo dependency refreshes the loads);
  // normal mode lets the action run and re-syncs via update().
  function punchEnhance(run: (repo: Repo) => Promise<ActionOutcome>, onSuccess?: () => void): SubmitFunction {
    return ({ cancel }) => {
      submitting = true;
      if (isDemo) {
        cancel();
        void (async () => {
          const { demoRepo } = await import('$lib/demo/repo');
          const out = await run(demoRepo);
          demoForm = out.data as ActionData;
          if (out.ok) onSuccess?.();
          await invalidate('demo:data');
          submitting = false;
        })();
        return;
      }
      return async ({ result, update }) => {
        await update();
        if (result.type === 'success') onSuccess?.();
        submitting = false;
      };
    };
  }

  const badTime = (message: string): ActionOutcome => ({ ok: false, status: 400, data: { error: message } });

  let adjustOpen = $state(false);
  let adjustTime = $state('');
  let resolveDate = $state('');
  let resolveTime = $state('');
  // Prefill the resolve date with the shift's start day; the field only
  // renders while stale, so the overwrite never fights a user mid-edit.
  $effect(() => {
    resolveDate = startedDate;
  });
  let discardOpen = $state(false);
</script>

<div class="flex flex-col gap-6">
  <div class="max-md:text-center">
    <h1 class="text-2xl font-semibold tracking-tight">Clock</h1>
    <p class="mt-1 text-sm text-muted-foreground">Punch in and out live — finished shifts land in the ledger.</p>
  </div>

  {#if data.stale && shift}
    <Card.Root class="border-destructive/50">
      <Card.Header class="max-md:text-center">
        <Card.Title>Still clocked in since {staleLabel}</Card.Title>
        <Card.Description>
          This punch started before today. Set when the shift really ended and save it to the ledger, or discard the
          punch — nothing saves on its own.
        </Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-2">
        <form
          method="POST"
          action="?/resolveSave"
          use:enhance={punchEnhance(async (repo) => {
            const hhmm = parseTimeInput(resolveTime);
            if (!hhmm) return badTime('Enter when the shift ended');
            return resolveSave(repo, zonedToMs(resolveDate, hhmm));
          })}
          class="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div class="flex flex-col gap-1.5 sm:w-44">
            <Label for="resolve-date">Shift ended on</Label>
            <DateField id="resolve-date" name="endDate" bind:value={resolveDate} max={data.today} />
          </div>
          <div class="flex flex-col gap-1.5 sm:w-32">
            <Label for="resolve-time">At</Label>
            <Input id="resolve-time" name="endTime" bind:value={resolveTime} placeholder={timePlaceholder} required />
          </div>
          <div class="flex gap-2 max-sm:flex-col">
            <Button type="submit" disabled={submitting}>Save shift</Button>
            <Button type="button" variant="outline" disabled={submitting} onclick={() => (discardOpen = true)}>
              Discard punch
            </Button>
          </div>
        </form>
        {#if errorMsg}
          <p class="text-sm text-destructive">{errorMsg}</p>
        {/if}
      </Card.Content>
    </Card.Root>
  {:else}
    <Card.Root>
      <Card.Content class="flex flex-col items-center gap-6 px-6 py-10 text-center">
        <div class="flex flex-col items-center gap-2">
          <p
            class="font-mono text-5xl font-semibold tabular-nums {data.state === 'idle'
              ? 'text-muted-foreground/50'
              : ''}"
          >
            {#if data.state === 'idle'}
              0:00:00
            {:else if data.state === 'working'}
              {fmtElapsed(workedMs)}
            {:else}
              {fmtElapsed(breakMs)}
            {/if}
          </p>
          {#if data.state === 'idle'}
            <p class="text-sm text-muted-foreground">Not clocked in</p>
          {:else if data.state === 'working'}
            <p class="text-sm text-muted-foreground">
              Clocked in at {sinceLabel}{shift && shift.breakSeconds > 0
                ? ` · ${hrs(shift.breakSeconds / 3600)} break so far`
                : ''}
              <button
                type="button"
                class="ml-1 underline decoration-dotted underline-offset-4 hover:text-foreground"
                onclick={() => (adjustOpen = !adjustOpen)}
              >
                adjust
              </button>
            </p>
          {:else}
            <p class="text-sm text-muted-foreground">
              On break since {breakSinceLabel} · {fmtElapsed(workedMs)} worked
            </p>
          {/if}
        </div>

        {#if data.state === 'working' && adjustOpen}
          <form
            method="POST"
            action="?/adjust"
            use:enhance={punchEnhance(
              async (repo) => {
                const hhmm = parseTimeInput(adjustTime);
                if (!hhmm) return badTime('Enter a time like 9:00 AM');
                return adjustStart(repo, zonedToMs(startedDate, hhmm), Date.now());
              },
              () => {
                adjustOpen = false;
                adjustTime = '';
              },
            )}
            class="flex items-end gap-2"
          >
            <input type="hidden" name="date" value={startedDate} />
            <div class="flex flex-col gap-1.5 text-left">
              <Label for="adjust-time">Actually clocked in at</Label>
              <Input
                id="adjust-time"
                name="time"
                bind:value={adjustTime}
                placeholder={data.timeFormat === '24h' ? '09:00' : '9:00 AM'}
                required
                class="w-36"
              />
            </div>
            <Button type="submit" variant="outline" disabled={submitting}>Fix it</Button>
          </form>
        {/if}

        <div class="flex flex-wrap justify-center gap-3">
          {#if data.state === 'idle'}
            <form
              method="POST"
              action="?/in"
              use:enhance={punchEnhance(async (repo) => {
                const s = await repo.getSettings();
                return clockIn(repo, Date.now(), s.clockBreakMode);
              })}
            >
              <Button type="submit" disabled={submitting} class="h-11 px-8 text-base">Clock in</Button>
            </form>
          {:else if data.state === 'working'}
            <form method="POST" action="?/breakStart" use:enhance={punchEnhance((repo) => startBreak(repo, Date.now()))}>
              <Button type="submit" variant="outline" disabled={submitting} class="h-11 px-6 text-base">
                Take a break
              </Button>
            </form>
            <form method="POST" action="?/out" use:enhance={punchEnhance((repo) => clockOut(repo, Date.now()))}>
              <Button type="submit" disabled={submitting} class="h-11 px-6 text-base">Clock out</Button>
            </form>
          {:else}
            <form method="POST" action="?/breakEnd" use:enhance={punchEnhance((repo) => endBreak(repo, Date.now()))}>
              <Button type="submit" disabled={submitting} class="h-11 px-6 text-base">Back to work</Button>
            </form>
            <form method="POST" action="?/out" use:enhance={punchEnhance((repo) => clockOut(repo, Date.now()))}>
              <Button type="submit" variant="outline" disabled={submitting} class="h-11 px-6 text-base">
                Clock out
              </Button>
            </form>
          {/if}
        </div>

        {#if errorMsg}
          <p class="text-sm text-destructive">{errorMsg}</p>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}

  <Card.Root>
    <Card.Header class="max-md:text-center">
      <Card.Title>Today</Card.Title>
      <Card.Description>
        {hrs(data.workedToday)} logged{shift && !data.stale ? ` · ${fmtElapsed(workedMs)} on the clock` : ''}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      {#if data.todayEntries.length === 0}
        <p class="text-sm text-muted-foreground max-md:text-center">No shifts logged today yet.</p>
      {:else}
        <ul class="flex flex-col divide-y divide-border/50 text-sm">
          {#each data.todayEntries as entry (entry.id)}
            <li class="flex items-center justify-between gap-3 py-2 font-mono tabular-nums">
              <span>
                {entry.startTime && entry.endTime
                  ? formatTimeRange(entry.startTime, entry.endTime, data.timeFormat)
                  : '—'}
              </span>
              <span>{hrs(entry.hours - entry.breakHours)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<Dialog.Root bind:open={discardOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Discard this punch?</Dialog.Title>
      <Dialog.Description>The open shift is thrown away and nothing lands in the ledger.</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (discardOpen = false)}>Cancel</Button>
      <form
        method="POST"
        action="?/resolveDiscard"
        use:enhance={(input) => {
          // Close at submit time (after the POST/cancel is underway) — closing
          // in onclick could unmount the form before the submit dispatches.
          const handler = punchEnhance((repo) => resolveDiscard(repo))(input);
          discardOpen = false;
          return handler;
        }}
      >
        <Button type="submit" variant="destructive" disabled={submitting} class="max-sm:w-full">Discard</Button>
      </form>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
