<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import { tick } from 'svelte';
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import DateField from '$lib/components/DateField.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { DEFAULT_SETTINGS } from '$lib/core/repo';
  import { saveSettingsAction } from '$lib/core/settings-page';
  import { todayISO } from '$lib/date';
  import { isDemo } from '$lib/demo/flag';
  import { workdaysJson } from '$lib/schemas/settings';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Demo mode intercepts the save client-side; results stand in for `form`.
  let demoForm = $state<ActionData>(null);
  const actionData = $derived(isDemo ? demoForm : form);

  const WEEKDAYS = [
    { n: 1, label: 'Mon' },
    { n: 2, label: 'Tue' },
    { n: 3, label: 'Wed' },
    { n: 4, label: 'Thu' },
    { n: 5, label: 'Fri' },
    { n: 6, label: 'Sat' },
    { n: 7, label: 'Sun' },
  ];

  const selected = $derived(new Set(data.settings.workdays));

  // Local mirrors of two form fields so the UI can react before saving:
  // the multiplier field greys out while the toggle is off, and the workday
  // chips reorder to match the chosen week start.
  // Initial-only reads; the form is the source of truth after first render.
  // svelte-ignore state_referenced_locally
  let otEnabled = $state(data.otMultiplierEnabled);
  // svelte-ignore state_referenced_locally
  let otMultiplierValue = $state(data.otMultiplier);
  // svelte-ignore state_referenced_locally
  let weekStartsOnValue = $state(String(data.weekStartsOn));
  // svelte-ignore state_referenced_locally
  let epochValue = $state(data.epoch);
  const orderedWeekdays = $derived(weekStartsOnValue === '7' ? [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)] : WEEKDAYS);
  const timeZones = Intl.supportedValuesOf('timeZone');

  // Every change saves on its own: the form-level onchange (and the
  // DateField's explicit one) schedules a debounced submit, so checkbox
  // clicks save immediately and number-spinner runs coalesce into one save.
  // requestSubmit runs native validation first — a half-typed required field
  // blocks the save with the browser hint instead of posting garbage.
  let formEl: HTMLFormElement | null = $state(null);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => formEl?.requestSubmit(), 400);
  }

  // Reset puts every control back to its out-of-the-box value, then saves
  // through the same submit path (programmatic .value writes fire no change
  // events, so the submit is explicit).
  let resetOpen = $state(false);
  const DEFAULT_WORKDAYS = new Set(workdaysJson.parse(JSON.parse(DEFAULT_SETTINGS.workdays)));
  async function resetToDefaults() {
    if (!formEl) return;
    const set = (name: string, value: string) => {
      const el = formEl?.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = value;
    };
    set('hourlyRate', String(DEFAULT_SETTINGS.hourlyRate));
    set('dailyHours', String(DEFAULT_SETTINGS.dailyHours));
    epochValue = DEFAULT_SETTINGS.epoch;
    set('timeFormat', DEFAULT_SETTINGS.timeFormat);
    set('ledgerPeriod', DEFAULT_SETTINGS.ledgerPeriod);
    set('timeZone', DEFAULT_SETTINGS.timeZone);
    set('clockBreakMode', DEFAULT_SETTINGS.clockBreakMode);
    for (const box of formEl.querySelectorAll<HTMLInputElement>('input[name="workdays"]')) {
      box.checked = DEFAULT_WORKDAYS.has(Number(box.value));
    }
    const flags: Array<[string, boolean]> = [
      ['hideWeekendsEntries', DEFAULT_SETTINGS.hideWeekendsEntries],
      ['hideWeekendsGrid', DEFAULT_SETTINGS.hideWeekendsGrid],
      ['expandNotes', DEFAULT_SETTINGS.expandNotes],
      ['observeDst', DEFAULT_SETTINGS.observeDst],
    ];
    for (const [name, value] of flags) {
      const el = formEl.elements.namedItem(name);
      if (el instanceof HTMLInputElement) el.checked = value;
    }
    otEnabled = DEFAULT_SETTINGS.otMultiplierEnabled;
    otMultiplierValue = DEFAULT_SETTINGS.otMultiplier;
    weekStartsOnValue = String(DEFAULT_SETTINGS.weekStartsOn);
    resetOpen = false;
    await tick();
    formEl.requestSubmit();
  }
</script>

<div class="flex flex-col gap-8">
  <div class="max-md:text-center">
    <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Your pay rate and the baseline that defines a "whole" week.
    </p>
  </div>

  <!-- reset: false — a reset would revert checkboxes to defaultChecked, which is
       false for all of them after a client-side navigation (no SSR attributes),
       wiping the workdays selection on every save. -->
  <form
    method="POST"
    bind:this={formEl}
    onchange={scheduleSave}
    use:enhance={({ formData, cancel }) => {
      if (isDemo) {
        cancel();
        void (async () => {
          const { demoRepo } = await import('$lib/demo/repo');
          const out = await saveSettingsAction(demoRepo, formData);
          demoForm = out.data as ActionData;
          await invalidate('demo:data');
        })();
        return;
      }
      return async ({ update }) => {
        await update({ reset: false });
      };
    }}
    class="flex flex-col gap-6"
  >
    <div class="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card.Root>
        <Card.Header class="max-md:text-center">
          <Card.Title>Pay & schedule</Card.Title>
        </Card.Header>
        <Card.Content class="flex flex-col divide-y divide-border/50">
          <section class="flex flex-col gap-3 pb-5">
            <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">Compensation</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div class="flex flex-col gap-1.5">
                <Label for="hourlyRate">Hourly rate (USD)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  name="hourlyRate"
                  step="any"
                  min="0"
                  value={data.settings.hourlyRate}
                  required
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="dailyHours">Hours per workday</Label>
                <Input
                  id="dailyHours"
                  type="number"
                  name="dailyHours"
                  step="0.25"
                  min="0.25"
                  max="24"
                  value={data.settings.dailyHours}
                  required
                />
              </div>
            </div>
          </section>

          <section class="flex flex-col gap-3 py-5">
            <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">Overtime</h3>
            <div class="rounded-md border border-input text-sm transition-colors has-checked:border-primary has-checked:bg-accent">
              <label class="flex cursor-pointer items-start gap-2 px-3 py-2">
                <input type="checkbox" name="otMultiplierEnabled" bind:checked={otEnabled} class="mt-0.5 accent-primary" />
                <span>
                  <span class="font-medium">Overtime multiplies pay</span>
                  <span class="block text-xs text-muted-foreground">
                    Day-hours beyond the daily baseline earn at the multiplier. Off keeps them at straight time —
                    overtime banks against shortfalls either way.
                  </span>
                </span>
              </label>
              <!-- Disabled while toggled off so it's fully inert; a disabled input
                   doesn't submit, so a hidden input carries the bound value and a
                   custom multiplier isn't silently reset to 1.5 on save. -->
              <div
                class="flex items-center justify-between gap-3 border-t border-border/50 px-3 py-2 transition-opacity {otEnabled
                  ? ''
                  : 'opacity-50'}"
              >
                <Label for="otMultiplier">Multiplier (× hourly rate)</Label>
                {#if !otEnabled}
                  <input type="hidden" name="otMultiplier" value={otMultiplierValue} />
                {/if}
                <!-- inputs can't render ::after, so the × suffix is an overlaid span -->
                <div class="relative w-24 shrink-0">
                  <Input
                    id="otMultiplier"
                    type="number"
                    name="otMultiplier"
                    step="0.05"
                    min="1"
                    max="10"
                    bind:value={otMultiplierValue}
                    required
                    disabled={!otEnabled}
                    class="pr-7 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                  >
                    ×
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section class="flex flex-col gap-4 pt-5">
            <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">Schedule</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div class="flex flex-col gap-1.5">
                <Label for="weekStartsOn">Week starts on</Label>
                <select
                  id="weekStartsOn"
                  name="weekStartsOn"
                  bind:value={weekStartsOnValue}
                  class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <option value="1">Monday</option>
                  <option value="7">Sunday</option>
                </select>
                <p class="text-xs text-muted-foreground">Weekly grid order and dashboard grouping.</p>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="epoch">Tracking since</Label>
                <DateField
                  id="epoch"
                  name="epoch"
                  bind:value={epochValue}
                  min="{Number(todayISO().slice(0, 4)) - 10}-01-01"
                  max={todayISO()}
                  onchange={scheduleSave}
                />
                <p class="text-xs text-muted-foreground">Earliest date that accrues the make-whole baseline.</p>
              </div>
            </div>
            <fieldset class="flex flex-col gap-1.5">
              <legend class="sr-only">Workdays</legend>
              <span class="text-sm font-medium">Workdays</span>
              <p class="text-xs text-muted-foreground">
                Days that accrue the baseline. Default is Mon–Fri (8h × 5 = 40h/week).
              </p>
              <!-- Below md: content-sized chips wrap only as needed, rows centered.
                   From md: basis pins four equal cells per row, so the 4+3 split
                   falls out of the wrap with the short row centered. -->
              <div class="mt-1 flex flex-wrap justify-center gap-1.5">
                {#each orderedWeekdays as day (day.n)}
                  <label
                    class="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input px-3 py-2 font-mono text-sm has-checked:border-primary has-checked:bg-accent md:basis-[calc(25%-4.5px)] md:px-1"
                  >
                    <input
                      type="checkbox"
                      name="workdays"
                      value={day.n}
                      checked={selected.has(day.n)}
                      class="accent-primary"
                    />
                    {day.label}
                  </label>
                {/each}
              </div>
            </fieldset>
          </section>

        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header class="max-md:text-center">
          <Card.Title>Clock & time</Card.Title>
        </Card.Header>
        <Card.Content class="flex flex-col gap-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div class="flex flex-col gap-1.5">
              <Label for="timeFormat">Time format</Label>
              <select
                id="timeFormat"
                name="timeFormat"
                class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <option value="12h" selected={data.timeFormat === '12h'}>12-hour (09:00 AM)</option>
                <option value="24h" selected={data.timeFormat === '24h'}>24-hour (09:00)</option>
              </select>
              <p class="text-xs text-muted-foreground">How clock in/out times display.</p>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="timeZone">Timezone</Label>
              <select
                id="timeZone"
                name="timeZone"
                class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {#each timeZones as tz (tz)}
                  <option value={tz} selected={data.timeZone === tz}>{tz.replaceAll('_', ' ')}</option>
                {/each}
              </select>
              <p class="text-xs text-muted-foreground">Defines "today" everywhere and stamps the clock.</p>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="clockBreakMode">Clock breaks</Label>
              <select
                id="clockBreakMode"
                name="clockBreakMode"
                class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <option value="accrue" selected={data.clockBreakMode === 'accrue'}>Accrue into the shift</option>
                <option value="split" selected={data.clockBreakMode === 'split'}>Split shifts at breaks</option>
              </select>
              <p class="text-xs text-muted-foreground">How punch-clock breaks land in the ledger.</p>
            </div>
          </div>
          <label
            class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
          >
            <input type="checkbox" name="observeDst" checked={data.observeDst} class="mt-0.5 accent-primary" />
            <span>
              <span class="font-medium">Observe daylight saving time</span>
              <span class="block text-xs text-muted-foreground">
                Off pins the timezone to its standard offset year-round (e.g. Central stays UTC−6).
              </span>
            </span>
          </label>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header class="max-md:text-center">
          <Card.Title>Log & Ledger</Card.Title>
        </Card.Header>
        <Card.Content class="flex flex-col divide-y divide-border/50">
          <fieldset class="flex flex-col gap-3 pb-5">
            <legend class="float-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:w-full max-md:text-center">
              Weekends
            </legend>
            <label
              class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
            >
              <input
                type="checkbox"
                name="hideWeekendsGrid"
                checked={data.hideWeekendsGrid}
                class="mt-0.5 accent-primary"
              />
              <span>
                <span class="font-medium">Hide weekends in Log a week</span>
                <span class="block text-xs text-muted-foreground">
                  The weekly grid shows only weekday rows, and empty weekends are hidden from the ledger too. Toggle
                  off temporarily to log an odd weekend shift.
                </span>
              </span>
            </label>
            <label
              class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
            >
              <input
                type="checkbox"
                name="hideWeekendsEntries"
                checked={data.hideWeekendsEntries}
                class="mt-0.5 accent-primary"
              />
              <span>
                <span class="font-medium">Hide empty weekends in Ledger</span>
                <span class="block text-xs text-muted-foreground">
                  Blank Sat/Sun rows are hidden from the ledger. Weekends with logged time still show.
                </span>
              </span>
            </label>
          </fieldset>

          <section class="flex flex-col gap-3 py-5">
            <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">Ledger</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div class="flex flex-col gap-1.5">
                <Label for="ledgerPeriod">Default period</Label>
                <select
                  id="ledgerPeriod"
                  name="ledgerPeriod"
                  class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <option value="week" selected={data.ledgerPeriod === 'week'}>Weekly</option>
                  <option value="biweek" selected={data.ledgerPeriod === 'biweek'}>Bi-weekly</option>
                  <option value="month" selected={data.ledgerPeriod === 'month'}>Monthly</option>
                  <option value="quarter" selected={data.ledgerPeriod === 'quarter'}>Quarterly</option>
                  <option value="year" selected={data.ledgerPeriod === 'year'}>Yearly</option>
                </select>
                <p class="text-xs text-muted-foreground">
                  How much the Ledger shows per page when the Log opens. Its selector still changes it per visit.
                </p>
              </div>
            </div>
          </section>

          <fieldset class="flex flex-col gap-3 pt-5">
            <legend class="float-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:w-full max-md:text-center">
              Notes
            </legend>
            <label
              class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
            >
              <input type="checkbox" name="expandNotes" checked={data.expandNotes} class="mt-0.5 accent-primary" />
              <span>
                <span class="font-medium">Expand notes by default</span>
                <span class="block text-xs text-muted-foreground">
                  The ledger opens with every note accordion expanded. Off keeps notes tucked behind the note action
                  on each row.
                </span>
              </span>
            </label>
          </fieldset>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Status bar spans all three cards: save feedback plus the reset escape hatch. -->
    <div class="flex flex-wrap items-center justify-end gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      {#if actionData?.saved}
        <span class="flex items-center gap-1 text-sm text-success"><Check class="size-4" /> Saved</span>
      {:else if actionData && 'error' in actionData && actionData.error}
        <span class="text-sm text-destructive">{actionData.error}</span>
      {:else}
        <span class="text-sm text-muted-foreground">Changes save automatically.</span>
      {/if}
      <Button type="button" variant="outline" onclick={() => (resetOpen = true)} class="max-md:flex-1">
        Reset to defaults
      </Button>
    </div>
  </form>
</div>

<Dialog.Root bind:open={resetOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Reset to defaults?</Dialog.Title>
      <Dialog.Description>
        Every setting goes back to its out-of-the-box value — pay rate, schedule, tracking epoch, and display
        options. The reset saves immediately.
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (resetOpen = false)}>Cancel</Button>
      <Button variant="destructive" onclick={resetToDefaults}>Reset</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
