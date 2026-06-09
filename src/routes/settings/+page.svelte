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
</script>

<div class="flex flex-col gap-8">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Your pay rate and the baseline that defines a "whole" week.
    </p>
  </div>

  <Card.Root class="max-w-xl">
    <Card.Content class="p-6">
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
            {#each WEEKDAYS as day (day.n)}
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
          <Label for="epoch">Tracking since</Label>
          <p class="text-xs text-muted-foreground">
            Earliest date that counts toward the make-whole baseline. The dashboard's year view still drives expected
            earnings — this just keeps year-one from accruing hours before you started.
          </p>
          <Input id="epoch" type="date" name="epoch" value={data.epoch} required class="w-full sm:w-48" />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="timeFormat">Time format</Label>
          <p class="text-xs text-muted-foreground">Display clock times in 12-hour (09:00 AM) or 24-hour (09:00) format.</p>
          <select
            id="timeFormat"
            name="timeFormat"
            class="h-9 w-full rounded-md border sm:w-48 border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="12h" selected={data.timeFormat === '12h'}>12-hour (09:00 AM)</option>
            <option value="24h" selected={data.timeFormat === '24h'}>24-hour (09:00)</option>
          </select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="weekStartsOn">Week starts on</Label>
          <p class="text-xs text-muted-foreground">Controls the weekly grid order and how weeks group on the dashboard.</p>
          <select
            id="weekStartsOn"
            name="weekStartsOn"
            class="h-9 w-full rounded-md border sm:w-48 border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="1" selected={data.weekStartsOn === 1}>Monday</option>
            <option value="7" selected={data.weekStartsOn === 7}>Sunday</option>
          </select>
        </div>

        <div class="flex items-center gap-3">
          <Button type="submit">Save settings</Button>
          {#if form?.saved}
            <span class="flex items-center gap-1 text-sm text-success"><Check class="size-4" /> Saved</span>
          {:else if form && 'error' in form && form.error}
            <span class="text-sm text-destructive">{form.error}</span>
          {/if}
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
