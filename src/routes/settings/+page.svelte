<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import Clock from '@lucide/svelte/icons/clock';
  import History from '@lucide/svelte/icons/history';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import NotebookText from '@lucide/svelte/icons/notebook-text';
  import ReceiptText from '@lucide/svelte/icons/receipt-text';
  import Wallet from '@lucide/svelte/icons/wallet';
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
  import {
    EXPENSE_KINDS,
    EXPENSE_META,
    MEAL_METHOD_LABELS,
    MEAL_VENDORS,
    PURCHASE_CADENCE_LABELS,
    PURCHASE_CADENCES,
    PURCHASE_VENDORS,
    RIDE_DIRECTION_LABELS,
    RIDE_DIRECTIONS,
    RIDE_VENDORS,
    VENDOR_LABELS,
    vendorMethods,
  } from '$lib/expense-kinds';
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

  // Sidebar shell: one section visible at a time. The hidden sections stay
  // mounted (display:none) so the single form still posts every value — the
  // save action validates the full settings shape on each submit.
  const SECTIONS = [
    { id: 'pay', title: 'Pay & schedule', icon: Wallet },
    { id: 'clock', title: 'Clock & time', icon: Clock },
    { id: 'ledger', title: 'Log & Ledger', icon: NotebookText },
    { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard },
    { id: 'expenses', title: 'Expenses', icon: ReceiptText },
  ] as const;
  type SectionId = (typeof SECTIONS)[number]['id'];
  let active = $state<SectionId>('pay');
  const activeSection = $derived(SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]);

  // Switching away from a section with an invalid field would hide the only
  // visible validation hint and silently block every later auto-save, so the
  // switch itself runs native validation first.
  function showSection(id: SectionId) {
    if (formEl?.reportValidity() ?? true) active = id;
  }

  // Local mirrors of form fields so the UI can react before saving: the
  // multiplier/goal fields grey out while their toggles are off, the workday
  // chips reorder to match the chosen week start, and the meal-method options
  // follow the chosen default vendor.
  // Initial-only reads; the form is the source of truth after first render.
  // svelte-ignore state_referenced_locally
  let otEnabled = $state(data.otMultiplierEnabled);
  // svelte-ignore state_referenced_locally
  let otMultiplierValue = $state(data.otMultiplier);
  // svelte-ignore state_referenced_locally
  let goalEnabled = $state(data.goalEnabled);
  // svelte-ignore state_referenced_locally
  let yearlyGoalValue = $state(data.yearlyGoal);
  // svelte-ignore state_referenced_locally
  let weekStartsOnValue = $state(String(data.weekStartsOn));
  // svelte-ignore state_referenced_locally
  let epochValue = $state(data.epoch);
  // svelte-ignore state_referenced_locally
  let defaultMealVendorValue = $state(data.defaultMealVendor);
  // svelte-ignore state_referenced_locally
  let defaultMealMethodValue = $state(data.defaultMealMethod);
  const orderedWeekdays = $derived(weekStartsOnValue === '7' ? [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)] : WEEKDAYS);
  const timeZones = Intl.supportedValuesOf('timeZone');

  const SELECT_CLASS =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none';

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
    set('defaultExpenseKind', DEFAULT_SETTINGS.defaultExpenseKind);
    set('defaultRideVendor', DEFAULT_SETTINGS.defaultRideVendor);
    set('defaultRideDirection', DEFAULT_SETTINGS.defaultRideDirection);
    set('defaultPurchaseVendor', DEFAULT_SETTINGS.defaultPurchaseVendor);
    set('defaultPurchaseCadence', DEFAULT_SETTINGS.defaultPurchaseCadence);
    defaultMealVendorValue = DEFAULT_SETTINGS.defaultMealVendor;
    defaultMealMethodValue = DEFAULT_SETTINGS.defaultMealMethod;
    for (const box of formEl.querySelectorAll<HTMLInputElement>('input[name="workdays"]')) {
      box.checked = DEFAULT_WORKDAYS.has(Number(box.value));
    }
    const flags: Array<[string, boolean]> = [
      ['hideWeekendsEntries', DEFAULT_SETTINGS.hideWeekendsEntries],
      ['hideWeekendsGrid', DEFAULT_SETTINGS.hideWeekendsGrid],
      ['expandNotes', DEFAULT_SETTINGS.expandNotes],
      ['observeDst', DEFAULT_SETTINGS.observeDst],
      ['countExpenses', DEFAULT_SETTINGS.countExpenses],
    ];
    for (const [name, value] of flags) {
      const el = formEl.elements.namedItem(name);
      if (el instanceof HTMLInputElement) el.checked = value;
    }
    otEnabled = DEFAULT_SETTINGS.otMultiplierEnabled;
    otMultiplierValue = DEFAULT_SETTINGS.otMultiplier;
    goalEnabled = DEFAULT_SETTINGS.goalEnabled;
    yearlyGoalValue = DEFAULT_SETTINGS.yearlyGoal;
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
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
      <!-- Section rail: vertical from md, horizontal scroll pills below. -->
      <nav
        aria-label="Settings sections"
        class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:sticky md:top-6 md:mx-0 md:w-48 md:shrink-0 md:flex-col md:overflow-visible md:p-0"
      >
        {#each SECTIONS as section (section.id)}
          {@const Icon = section.icon}
          <button
            type="button"
            onclick={() => showSection(section.id)}
            aria-current={active === section.id ? 'true' : undefined}
            class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors {active ===
            section.id
              ? 'bg-accent font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
          >
            <Icon class="size-4 shrink-0" />
            {section.title}
          </button>
        {/each}
      </nav>

      <Card.Root class="min-w-0 flex-1 lg:max-w-3xl">
        <Card.Header class="max-md:text-center">
          <Card.Title>{activeSection.title}</Card.Title>
        </Card.Header>
        <Card.Content>
          <!-- ── Pay & schedule ─────────────────────────────────────────── -->
          <div class="flex-col divide-y divide-border/50 {active === 'pay' ? 'flex' : 'hidden'}">
            <section class="flex flex-col gap-3 pb-5">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                Compensation
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                Overtime
              </h3>
              <div
                class="rounded-md border border-input text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
              >
                <label class="flex cursor-pointer items-start gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    name="otMultiplierEnabled"
                    bind:checked={otEnabled}
                    class="mt-0.5 accent-primary"
                  />
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
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                Schedule
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <Label for="weekStartsOn">Week starts on</Label>
                  <select id="weekStartsOn" name="weekStartsOn" bind:value={weekStartsOnValue} class={SELECT_CLASS}>
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
                <!-- Content-sized chips wrap as needed; the wide pane fits all
                     seven on one row, narrow screens center the wrapped rows. -->
                <div class="mt-1 flex flex-wrap justify-center gap-1.5">
                  {#each orderedWeekdays as day (day.n)}
                    <label
                      class="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input px-3 py-2 font-mono text-sm has-checked:border-primary has-checked:bg-accent"
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
          </div>

          <!-- ── Clock & time ───────────────────────────────────────────── -->
          <div class="flex-col gap-4 {active === 'clock' ? 'flex' : 'hidden'}">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label for="timeFormat">Time format</Label>
                <select id="timeFormat" name="timeFormat" class={SELECT_CLASS}>
                  <option value="12h" selected={data.timeFormat === '12h'}>12-hour (09:00 AM)</option>
                  <option value="24h" selected={data.timeFormat === '24h'}>24-hour (09:00)</option>
                </select>
                <p class="text-xs text-muted-foreground">How clock in/out times display.</p>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="timeZone">Timezone</Label>
                <select id="timeZone" name="timeZone" class={SELECT_CLASS}>
                  {#each timeZones as tz (tz)}
                    <option value={tz} selected={data.timeZone === tz}>{tz.replaceAll('_', ' ')}</option>
                  {/each}
                </select>
                <p class="text-xs text-muted-foreground">Defines "today" everywhere and stamps the clock.</p>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="clockBreakMode">Clock breaks</Label>
                <select id="clockBreakMode" name="clockBreakMode" class={SELECT_CLASS}>
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
          </div>

          <!-- ── Log & Ledger ───────────────────────────────────────────── -->
          <div class="flex-col divide-y divide-border/50 {active === 'ledger' ? 'flex' : 'hidden'}">
            <fieldset class="flex flex-col gap-3 pb-5">
              <legend
                class="float-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:w-full max-md:text-center"
              >
                Weekends
              </legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      The weekly grid shows only weekday rows, and empty weekends are hidden from the ledger too.
                      Toggle off temporarily to log an odd weekend shift.
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
              </div>
            </fieldset>

            <section class="flex flex-col gap-3 py-5">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                Ledger
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <Label for="ledgerPeriod">Default period</Label>
                  <select id="ledgerPeriod" name="ledgerPeriod" class={SELECT_CLASS}>
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
                <div class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium">Notes</span>
                  <label
                    class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
                  >
                    <input
                      type="checkbox"
                      name="expandNotes"
                      checked={data.expandNotes}
                      class="mt-0.5 accent-primary"
                    />
                    <span>
                      <span class="font-medium">Expand notes by default</span>
                      <span class="block text-xs text-muted-foreground">
                        The ledger opens with every note accordion expanded. Off keeps notes tucked behind the note
                        action on each row.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </section>

            <section class="flex flex-col gap-3 pt-5">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                History
              </h3>
              <!-- Indigo is the audit log's own hue — unclaimed by the leave
                   chips (emerald/rose/violet/sky) and the amber weekend tint. -->
              <Button
                href="/settings/audit"
                variant="outline"
                class="w-full border-indigo-500/40 bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 hover:text-indigo-700 sm:w-fit dark:text-indigo-300 dark:hover:text-indigo-300"
              >
                <History class="size-4" /> View audit log
              </Button>
              <p class="text-xs text-muted-foreground">
                Every add, edit, and delete on the ledger, timestamped, with a snapshot of the entry as it was.
              </p>
            </section>
          </div>

          <!-- ── Dashboard ──────────────────────────────────────────────── -->
          <div class="flex-col divide-y divide-border/50 {active === 'dashboard' ? 'flex' : 'hidden'}">
            <section class="flex flex-col gap-3 pb-5">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                Goal
              </h3>
              <div
                class="rounded-md border border-input text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
              >
                <label class="flex cursor-pointer items-start gap-2 px-3 py-2">
                  <input type="checkbox" name="goalEnabled" bind:checked={goalEnabled} class="mt-0.5 accent-primary" />
                  <span>
                    <span class="font-medium">Chase a yearly goal</span>
                    <span class="block text-xs text-muted-foreground">
                      Target take-home for the year — e.g. stretching for $82k on an $80k salary via overtime. Off
                      keeps the target at straight salary math.
                    </span>
                  </span>
                </label>
                <!-- Disabled while toggled off so it's fully inert; a disabled input
                     doesn't submit, so a hidden input carries the bound value and a
                     custom goal isn't silently reset on save. -->
                <div
                  class="flex items-center justify-between gap-3 border-t border-border/50 px-3 py-2 transition-opacity {goalEnabled
                    ? ''
                    : 'opacity-50'}"
                >
                  <Label for="yearlyGoal">Yearly goal (USD)</Label>
                  {#if !goalEnabled}
                    <input type="hidden" name="yearlyGoal" value={yearlyGoalValue} />
                  {/if}
                  <div class="relative w-32 shrink-0">
                    <span
                      aria-hidden="true"
                      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
                    >
                      $
                    </span>
                    <Input
                      id="yearlyGoal"
                      type="number"
                      name="yearlyGoal"
                      step="500"
                      min="0"
                      max="10000000"
                      bind:value={yearlyGoalValue}
                      required
                      disabled={!goalEnabled}
                      class="pl-7 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="flex flex-col gap-3 pt-5">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                Expenses
              </h3>
              <label
                class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
              >
                <input
                  type="checkbox"
                  name="countExpenses"
                  checked={data.countExpenses}
                  class="mt-0.5 accent-primary"
                />
                <span>
                  <span class="font-medium">Count expenses by default</span>
                  <span class="block text-xs text-muted-foreground">
                    The dashboard opens with logged expenses folded into the hours to make up. Its per-period toggle
                    still flips it per visit.
                  </span>
                </span>
              </label>
              <p class="text-xs text-muted-foreground">Bonus tracking is planned and will live here.</p>
            </section>
          </div>

          <!-- ── Expenses ───────────────────────────────────────────────── -->
          <div class="flex-col divide-y divide-border/50 {active === 'expenses' ? 'flex' : 'hidden'}">
            <section class="flex flex-col gap-3 pb-5">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                New expenses
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <Label for="defaultExpenseKind">Default kind</Label>
                  <select id="defaultExpenseKind" name="defaultExpenseKind" class={SELECT_CLASS}>
                    {#each EXPENSE_KINDS as kind (kind)}
                      <option value={kind} selected={data.defaultExpenseKind === kind}>
                        {EXPENSE_META[kind].label}
                      </option>
                    {/each}
                  </select>
                  <p class="text-xs text-muted-foreground">What the add-expense form opens with.</p>
                </div>
              </div>
            </section>

            <section class="flex flex-col gap-3 py-5">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                Ride defaults
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <Label for="defaultRideVendor">Service</Label>
                  <select id="defaultRideVendor" name="defaultRideVendor" class={SELECT_CLASS}>
                    {#each RIDE_VENDORS as vendor (vendor)}
                      <option value={vendor} selected={data.defaultRideVendor === vendor}>
                        {VENDOR_LABELS[vendor]}
                      </option>
                    {/each}
                  </select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="defaultRideDirection">Direction</Label>
                  <select id="defaultRideDirection" name="defaultRideDirection" class={SELECT_CLASS}>
                    {#each RIDE_DIRECTIONS as direction (direction)}
                      <option value={direction} selected={data.defaultRideDirection === direction}>
                        {RIDE_DIRECTION_LABELS[direction]}
                      </option>
                    {/each}
                  </select>
                </div>
              </div>
            </section>

            <section class="flex flex-col gap-3 py-5">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                Meal defaults
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <Label for="defaultMealVendor">Service</Label>
                  <!-- Dine-in only fits a restaurant; switching to a delivery app coerces it away. -->
                  <select
                    id="defaultMealVendor"
                    name="defaultMealVendor"
                    bind:value={defaultMealVendorValue}
                    onchange={() => {
                      if (!vendorMethods(defaultMealVendorValue).includes(defaultMealMethodValue)) {
                        defaultMealMethodValue = 'delivery';
                      }
                    }}
                    class={SELECT_CLASS}
                  >
                    {#each MEAL_VENDORS as vendor (vendor)}
                      <option value={vendor}>{VENDOR_LABELS[vendor]}</option>
                    {/each}
                  </select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="defaultMealMethod">Method</Label>
                  <select
                    id="defaultMealMethod"
                    name="defaultMealMethod"
                    bind:value={defaultMealMethodValue}
                    class={SELECT_CLASS}
                  >
                    {#each vendorMethods(defaultMealVendorValue) as method (method)}
                      <option value={method}>{MEAL_METHOD_LABELS[method]}</option>
                    {/each}
                  </select>
                </div>
              </div>
            </section>

            <section class="flex flex-col gap-3 pt-5">
              <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
                Purchase defaults
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <Label for="defaultPurchaseVendor">Category</Label>
                  <select id="defaultPurchaseVendor" name="defaultPurchaseVendor" class={SELECT_CLASS}>
                    {#each PURCHASE_VENDORS as vendor (vendor)}
                      <option value={vendor} selected={data.defaultPurchaseVendor === vendor}>
                        {VENDOR_LABELS[vendor]}
                      </option>
                    {/each}
                  </select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="defaultPurchaseCadence">Cadence</Label>
                  <select id="defaultPurchaseCadence" name="defaultPurchaseCadence" class={SELECT_CLASS}>
                    {#each PURCHASE_CADENCES as cadence (cadence)}
                      <option value={cadence} selected={data.defaultPurchaseCadence === cadence}>
                        {PURCHASE_CADENCE_LABELS[cadence]}
                      </option>
                    {/each}
                  </select>
                  <p class="text-xs text-muted-foreground">Used when the category is Subscription.</p>
                </div>
              </div>
            </section>
          </div>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Status bar spans rail + pane: save feedback plus the reset escape hatch. -->
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
