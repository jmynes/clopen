<script lang="ts">
  import Eraser from '@lucide/svelte/icons/eraser';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash2 from '@lucide/svelte/icons/trash-2';
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
  import { type ActionOutcome, clearPeriodAction, deleteAction, updateAction } from '$lib/core/log';
  import type { Repo } from '$lib/core/repo';
  import { effectiveZone, formatDay, formatTime, formatTimeRange, setAppTimeZone, zonedParts, zonedToMs } from '$lib/date';
  import type { TimeEntry } from '$lib/db/schema';
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
  function punchEnhance(
    run: (repo: Repo, formData: FormData) => Promise<ActionOutcome>,
    onSuccess?: () => void,
  ): SubmitFunction {
    return ({ cancel, formData }) => {
      submitting = true;
      if (isDemo) {
        cancel();
        void (async () => {
          try {
            const { demoRepo } = await import('$lib/demo/repo');
            // Pin the zone like the server actions do: composition derives its
            // wall-clock fields from it, and a punch shouldn't depend on the
            // layout load having run first.
            const s = await demoRepo.getSettings();
            setAppTimeZone(effectiveZone(s.timeZone, s.observeDst));
            const out = await run(demoRepo, formData);
            demoForm = out.data as ActionData;
            if (out.ok) onSuccess?.();
            await invalidate('demo:data');
          } finally {
            submitting = false;
          }
        })();
        return;
      }
      return async ({ result, update }) => {
        try {
          await update();
          if (result.type === 'success') onSuccess?.();
        } finally {
          submitting = false;
        }
      };
    };
  }

  const badTime = (message: string): ActionOutcome => ({ ok: false, status: 400, data: { error: message } });

  // ── Daily progress ring + projected finish ───────────────────────────────
  // Today's total: completed entries plus the live shift. In split mode the
  // finished segments are already entries, and workedMs freezes on accrue
  // breaks, so nothing double-counts.
  const totalTodayH = $derived(data.workedToday + workedMs / 3_600_000);
  const ringPct = $derived(data.dailyHours > 0 ? Math.min(1, totalTodayH / data.dailyHours) : 0);
  const met = $derived(data.dailyHours > 0 && totalTodayH >= data.dailyHours);
  // Finish time if work continues from this second — frozen worked time on a
  // break means the projection honestly slides a second per second.
  const etaLabel = $derived.by(() => {
    if (met || !shift || data.stale || data.state === 'idle') return null;
    const etaMs = nowMs + (data.dailyHours - totalTodayH) * 3_600_000;
    return formatTime(zonedParts(etaMs).hhmm, data.timeFormat);
  });
  const RING_R = 46;
  const RING_CIRC = 2 * Math.PI * RING_R;

  let adjustOpen = $state(false);
  let adjustTime = $state('');
  // Initial-only read: prefill the resolve date once; the user owns it after.
  // svelte-ignore state_referenced_locally
  let resolveDate = $state(startedDate);
  let resolveTime = $state('');
  let discardOpen = $state(false);

  // ── Today-card edit / delete / clear-day (same core actions as the Log) ──
  let editingEntry = $state<TimeEntry | null>(null);
  let eStart = $state('');
  let eEnd = $state('');
  let eHours = $state('');
  let eBreak = $state('');
  let eNote = $state('');
  function openEdit(entry: TimeEntry) {
    editingEntry = entry;
    eStart = entry.startTime ?? '';
    eEnd = entry.endTime ?? '';
    eHours = String(entry.hours);
    eBreak = String(entry.breakHours);
    eNote = entry.note ?? '';
  }
  // Clock-mode edit when the shift has punch times; plain hours otherwise.
  const editIsClock = $derived(!!(editingEntry?.startTime && editingEntry?.endTime));
  const editError = $derived.by(() => {
    if (!actionData || !('editFieldErrors' in actionData)) return null;
    const v = (actionData as Record<string, unknown>).editFieldErrors;
    return v && typeof v === 'object' ? Object.values(v).join('; ') : null;
  });

  let deletingEntry = $state<TimeEntry | null>(null);
  let clearDayOpen = $state(false);
  // Confirm dialogs focus their destructive button on open so Enter confirms.
  let deleteEntryBtn = $state<HTMLElement | null>(null);
  let clearDayBtn = $state<HTMLElement | null>(null);
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
        <div class="flex flex-col items-center gap-3">
          <!-- Daily progress ring: the arc is today's total against the daily
               baseline, so it fills across shifts, not just the running one. -->
          <div class="relative size-60">
            <svg viewBox="0 0 100 100" class="size-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r={RING_R} fill="none" stroke-width="5" class="stroke-muted" />
              <circle
                cx="50"
                cy="50"
                r={RING_R}
                fill="none"
                stroke-width="5"
                stroke-linecap="round"
                stroke-dasharray={RING_CIRC}
                stroke-dashoffset={RING_CIRC * (1 - ringPct)}
                class="transition-[stroke-dashoffset] duration-500 {met ? 'stroke-success' : 'stroke-primary'}"
              />
            </svg>
            <div
              class="absolute inset-0 flex flex-col items-center justify-center gap-1"
              role="progressbar"
              aria-label="Today against the daily baseline"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(ringPct * 100)}
            >
              <p
                class="font-mono text-4xl font-semibold tabular-nums {data.state === 'idle'
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
              <p class="text-xs tabular-nums {met ? 'font-medium text-success' : 'text-muted-foreground'}">
                {hrs(totalTodayH)} of {data.dailyHours}h
              </p>
            </div>
          </div>
          {#if data.state === 'idle'}
            <p class="text-sm text-muted-foreground">Not clocked in</p>
          {:else if data.state === 'working'}
            <p class="text-sm text-muted-foreground">
              Clocked in at {sinceLabel}{shift && shift.breakSeconds > 0
                ? ` · ${hrs(shift.breakSeconds / 3600)} break so far`
                : ''}
              <button
                type="button"
                aria-label="Adjust clock-in time"
                class="ml-1 underline decoration-dotted underline-offset-4 hover:text-foreground"
                onclick={() => (adjustOpen = !adjustOpen)}
              >
                adjust
              </button>
            </p>
          {:else}
            <p class="text-sm text-muted-foreground">
              On break since {breakSinceLabel} · {shift?.startedAt != null
                ? `${fmtElapsed(workedMs)} worked`
                : `${hrs(data.workedToday)} logged today`}
            </p>
          {/if}
          {#if met}
            <p class="text-sm font-medium text-success">
              Baseline met · +{hrs(totalTodayH - data.dailyHours)} over
            </p>
          {:else if etaLabel}
            <p class="text-sm text-muted-foreground">On pace to hit {data.dailyHours}h at ~{etaLabel}</p>
          {/if}
          {#if !data.isTodayWorkday}
            <p class="text-xs text-muted-foreground">Day off — no hours expected today</p>
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
    <Card.Header class="flex flex-row flex-wrap items-center justify-between gap-2 max-md:text-center">
      <div>
        <Card.Title>Today</Card.Title>
        <Card.Description>
          {hrs(data.workedToday)} logged{shift && !data.stale && shift.startedAt != null ? ` · ${fmtElapsed(workedMs)} on the clock` : ''}
        </Card.Description>
      </div>
      {#if data.todayEntries.length > 0}
        <Button
          variant="outline"
          size="sm"
          class="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="Delete every entry logged today"
          onclick={() => (clearDayOpen = true)}
        >
          <Eraser class="size-4" /> Clear day
        </Button>
      {/if}
    </Card.Header>
    <Card.Content>
      {#if data.todayEntries.length === 0}
        <p class="text-sm text-muted-foreground max-md:text-center">No shifts logged today yet.</p>
      {:else}
        <ul class="flex flex-col divide-y divide-border/50 text-sm">
          {#each data.todayEntries as entry (entry.id)}
            <li class="flex items-center justify-between gap-3 py-1 font-mono tabular-nums">
              <span>
                {entry.startTime && entry.endTime
                  ? formatTimeRange(entry.startTime, entry.endTime, data.timeFormat)
                  : '—'}
              </span>
              <span class="flex items-center gap-1">
                {hrs(entry.hours - entry.breakHours)}
                <span class="-mr-2 ml-1 flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    title={entry.entryKind === 'work' ? 'Edit shift' : 'Edit leave entries in the Log'}
                    aria-label="Edit shift"
                    disabled={entry.entryKind !== 'work' || submitting}
                    onclick={() => openEdit(entry)}
                  >
                    <Pencil class="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Delete shift"
                    aria-label="Delete shift"
                    class="text-destructive hover:text-destructive"
                    disabled={submitting}
                    onclick={() => (deletingEntry = entry)}
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </span>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<!-- edit a Today shift: clock-mode when it has punch times, plain hours otherwise -->
<Dialog.Root
  open={editingEntry !== null}
  onOpenChange={(o) => {
    if (!o) editingEntry = null;
  }}
>
  <Dialog.Content class="sm:max-w-md">
    {#if editingEntry}
      <Dialog.Header>
        <Dialog.Title>Edit shift</Dialog.Title>
        <Dialog.Description>Changes land in the ledger like any other edit.</Dialog.Description>
      </Dialog.Header>
      <form
        method="POST"
        action="?/update"
        use:enhance={punchEnhance((repo, formData) => updateAction(repo, formData), () => (editingEntry = null))}
        class="flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={editingEntry.id} />
        <input type="hidden" name="date" value={editingEntry.date} />
        {#if editIsClock}
          <input type="hidden" name="mode" value="clock" />
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="edit-start">Clock in</Label>
              <Input id="edit-start" name="startTime" bind:value={eStart} placeholder={timePlaceholder} required />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="edit-end">Clock out</Label>
              <Input id="edit-end" name="endTime" bind:value={eEnd} placeholder={timePlaceholder} required />
            </div>
          </div>
        {:else}
          <div class="flex flex-col gap-1.5">
            <Label for="edit-hours">Hours worked</Label>
            <Input id="edit-hours" type="number" name="hours" step="0.25" min="0.25" max="24" bind:value={eHours} required />
          </div>
        {/if}
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <Label for="edit-break">Break (hours)</Label>
            <Input id="edit-break" type="number" name="breakHours" step="0.25" min="0" max="24" bind:value={eBreak} />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="edit-note">Note</Label>
            <Input id="edit-note" type="text" name="note" maxlength={500} bind:value={eNote} />
          </div>
        </div>
        {#if editError}
          <p class="text-sm text-destructive">{editError}</p>
        {/if}
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (editingEntry = null)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>Save</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- delete one Today shift -->
<Dialog.Root
  open={deletingEntry !== null}
  onOpenChange={(o) => {
    if (!o) deletingEntry = null;
  }}
>
  <Dialog.Content
    class="sm:max-w-md"
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      deleteEntryBtn?.focus();
    }}
  >
    {#if deletingEntry}
      <Dialog.Header>
        <Dialog.Title>Delete this shift?</Dialog.Title>
        <Dialog.Description>
          {deletingEntry.startTime && deletingEntry.endTime
            ? formatTimeRange(deletingEntry.startTime, deletingEntry.endTime, data.timeFormat)
            : 'Untimed entry'} · {hrs(deletingEntry.hours - deletingEntry.breakHours)} worked. This can't be undone.
        </Dialog.Description>
      </Dialog.Header>
      <form
        method="POST"
        action="?/delete"
        use:enhance={punchEnhance((repo, formData) => deleteAction(repo, formData), () => (deletingEntry = null))}
      >
        <input type="hidden" name="id" value={deletingEntry.id} />
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (deletingEntry = null)}>Cancel</Button>
          <Button type="submit" variant="destructive" bind:ref={deleteEntryBtn} disabled={submitting}>Delete</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- wipe the whole day -->
<Dialog.Root bind:open={clearDayOpen}>
  <Dialog.Content
    class="sm:max-w-md"
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      clearDayBtn?.focus();
    }}
  >
    <Dialog.Header>
      <Dialog.Title>Clear today?</Dialog.Title>
      <Dialog.Description>
        Delete all {data.todayEntries.length} of today's entries. Each deletion lands in the audit log, but this
        can't be undone.
      </Dialog.Description>
    </Dialog.Header>
    <form
      method="POST"
      action="?/clearDay"
      use:enhance={punchEnhance((repo, formData) => clearPeriodAction(repo, formData), () => (clearDayOpen = false))}
    >
      <input type="hidden" name="start" value={data.today} />
      <input type="hidden" name="end" value={data.today} />
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (clearDayOpen = false)}>Cancel</Button>
        <Button type="submit" variant="destructive" bind:ref={clearDayBtn} disabled={submitting}>Clear day</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

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
