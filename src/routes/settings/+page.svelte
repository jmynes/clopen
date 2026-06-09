<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

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
  let weekStartsOnValue = $state(String(data.weekStartsOn));
  const orderedWeekdays = $derived(weekStartsOnValue === '7' ? [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)] : WEEKDAYS);
</script>

<div class="flex flex-col gap-8">
  <div>
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
    use:enhance={() =>
      async ({ update }) => {
        await update({ reset: false });
      }}
    class="flex flex-col gap-6"
  >
    <div class="grid items-start gap-6 md:grid-cols-2">
      <Card.Root>
        <Card.Header>
          <Card.Title>Pay & schedule</Card.Title>
        </Card.Header>
        <Card.Content class="flex flex-col gap-6">
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

        <fieldset class="flex flex-col gap-2">
          <legend class="mb-1 text-sm font-medium">Workdays</legend>
          <p class="mb-2 text-xs text-muted-foreground">
            Days that accrue the baseline. Default is Mon–Fri (8h × 5 = 40h/week).
          </p>
          <div class="flex flex-wrap gap-2">
            {#each orderedWeekdays as day (day.n)}
              <label
                class="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent"
              >
                <input type="checkbox" name="workdays" value={day.n} checked={selected.has(day.n)} class="accent-primary" />
                {day.label}
              </label>
            {/each}
          </div>
        </fieldset>

        <div class="flex flex-col gap-1.5">
          <Label for="weekStartsOn">Week starts on</Label>
          <p class="text-xs text-muted-foreground">Controls the weekly grid order and how weeks group on the dashboard.</p>
          <select
            id="weekStartsOn"
            name="weekStartsOn"
            bind:value={weekStartsOnValue}
            class="h-9 w-full rounded-md border md:w-48 border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="1">Monday</option>
            <option value="7">Sunday</option>
          </select>
        </div>

        <fieldset class="flex flex-col gap-2">
          <legend class="mb-1 text-sm font-medium">Overtime</legend>
          <label
            class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent"
          >
            <input type="checkbox" name="otMultiplierEnabled" bind:checked={otEnabled} class="mt-0.5 accent-primary" />
            <span>
              <span class="font-medium">Overtime multiplies pay</span>
              <span class="block text-xs text-muted-foreground">
                Day-hours beyond the daily baseline earn at the multiplier below. Off keeps them at straight time —
                overtime banks against shortfalls either way.
              </span>
            </span>
          </label>
          <!-- readonly, not disabled, while toggled off: a disabled input wouldn't
               submit and saving would silently reset a custom multiplier to 1.5 -->
          <div class="flex flex-col gap-1.5 transition-opacity {otEnabled ? '' : 'opacity-50'}">
            <Label for="otMultiplier">Multiplier (× hourly rate)</Label>
            <!-- inputs can't render ::after, so the × suffix is an overlaid span -->
            <div class="relative w-full md:w-28">
              <Input
                id="otMultiplier"
                type="number"
                name="otMultiplier"
                step="0.05"
                min="1"
                max="10"
                value={data.otMultiplier}
                required
                readonly={!otEnabled}
                tabindex={otEnabled ? undefined : -1}
                class="pr-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span
                aria-hidden="true"
                class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
              >
                ×
              </span>
            </div>
          </div>
        </fieldset>

        <div class="flex flex-col gap-1.5">
          <Label for="epoch">Tracking since</Label>
          <p class="text-xs text-muted-foreground">
            Earliest date that counts toward the make-whole baseline. The dashboard's year view still drives expected
            earnings — this just keeps year-one from accruing hours before you started.
          </p>
          <Input id="epoch" type="date" name="epoch" value={data.epoch} required class="w-full md:w-48" />
        </div>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>Display & entries</Card.Title>
        </Card.Header>
        <Card.Content class="flex flex-col gap-6">
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-1 text-sm font-medium">Weekends</legend>
          <label
            class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent"
          >
            <input
              type="checkbox"
              name="hideWeekendsEntries"
              checked={data.hideWeekendsEntries}
              class="mt-0.5 accent-primary"
            />
            <span>
              <span class="font-medium">Hide empty weekends in Entries</span>
              <span class="block text-xs text-muted-foreground">
                Blank Sat/Sun rows are hidden from the entries list. Weekends with logged time still show.
              </span>
            </span>
          </label>
          <label
            class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent"
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
                The weekly grid shows only weekday rows, and empty weekends are hidden from Entries too. Toggle off
                temporarily to log an odd weekend shift.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset class="flex flex-col gap-2">
          <legend class="mb-1 text-sm font-medium">Notes</legend>
          <label
            class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent"
          >
            <input type="checkbox" name="expandNotes" checked={data.expandNotes} class="mt-0.5 accent-primary" />
            <span>
              <span class="font-medium">Expand notes by default</span>
              <span class="block text-xs text-muted-foreground">
                Entries open with every note accordion expanded. Off keeps notes tucked behind the note action on each
                row.
              </span>
            </span>
          </label>
        </fieldset>

        <div class="flex flex-col gap-1.5">
          <Label for="timeFormat">Time format</Label>
          <p class="text-xs text-muted-foreground">Display clock times in 12-hour (09:00 AM) or 24-hour (09:00) format.</p>
          <select
            id="timeFormat"
            name="timeFormat"
            class="h-9 w-full rounded-md border md:w-48 border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="12h" selected={data.timeFormat === '12h'}>12-hour (09:00 AM)</option>
            <option value="24h" selected={data.timeFormat === '24h'}>24-hour (09:00)</option>
          </select>
        </div>

        </Card.Content>
      </Card.Root>
    </div>

    <!-- Footer action bar spans both cards so Save reads as the form's footer. -->
    <div class="flex flex-wrap items-center justify-end gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      {#if form?.saved}
        <span class="flex items-center gap-1 text-sm text-success"><Check class="size-4" /> Saved</span>
      {:else if form && 'error' in form && form.error}
        <span class="text-sm text-destructive">{form.error}</span>
      {/if}
      <Button type="submit" class="hover:bg-primary/75 max-md:w-full">Save settings</Button>
    </div>
  </form>
</div>
