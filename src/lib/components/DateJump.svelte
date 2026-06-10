<!--
  A compact "jump to date" control for the date-navigation bars (dashboard
  period nav, week grid, ledger). A calendar-icon button opens a popover with
  the shadcn month-grid calendar; picking a day fires `onpick` with its ISO
  string. The month/year dropdowns and reachable days are floored at `min`
  (the tracking epoch) and capped at `max`, so navigation starts at the epoch
  rather than scrolling through years that predate tracking.
-->
<script lang="ts">
  import { type DateValue, parseDate } from '@internationalized/date';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import { mergeProps } from 'bits-ui';
  import { Button } from '$lib/components/ui/button';
  import { Calendar } from '$lib/components/ui/calendar';
  import * as Popover from '$lib/components/ui/popover';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { todayISO } from '$lib/date';

  let {
    value = '',
    min = undefined,
    max = undefined,
    label = 'Jump to date',
    onpick,
  }: {
    value?: string;
    min?: string;
    max?: string;
    label?: string;
    onpick: (iso: string) => void;
  } = $props();

  // Parse an ISO YYYY-MM-DD into a CalendarDate; ignore anything malformed.
  function toDate(iso: string | undefined): DateValue | undefined {
    if (!iso) return undefined;
    try {
      return parseDate(iso);
    } catch {
      return undefined;
    }
  }

  const minValue = $derived(toDate(min));
  // Without an explicit max, cap the year dropdown one year past today so the
  // run is [epoch … near future] rather than an unbounded year spinner.
  const maxValue = $derived(toDate(max) ?? toDate(`${Number(todayISO().slice(0, 4)) + 1}-12-31`));

  let open = $state(false);
  let selected = $state<DateValue | undefined>(undefined);
  let placeholder = $state<DateValue | undefined>(undefined);

  // Mirror the external value into the calendar's selection + opening month,
  // re-syncing whenever the parent moves the anchor. Falls back to the epoch
  // (then today) so an empty value still opens at a sensible, in-range month.
  $effect(() => {
    const v = toDate(value);
    selected = v;
    placeholder = v ?? minValue ?? toDate(todayISO());
  });
</script>

<Popover.Root bind:open>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props: tooltipProps })}
        <Popover.Trigger>
          {#snippet child({ props: popoverProps })}
            <!-- mergeProps chains the two triggers' shared event handlers; a
                 plain double-spread lets one clobber the other's pointer
                 tracking and the tooltip jams after the first hover. -->
            <Button
              {...mergeProps(tooltipProps, popoverProps)}
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label={label}
            >
              <CalendarDays class="size-4" />
            </Button>
          {/snippet}
        </Popover.Trigger>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>{label}</Tooltip.Content>
  </Tooltip.Root>
  <Popover.Content class="w-auto p-0" align="end">
    <Calendar
      type="single"
      bind:value={selected}
      bind:placeholder
      {minValue}
      {maxValue}
      captionLayout="dropdown"
      onValueChange={(v) => {
        if (v) {
          onpick(v.toString());
          open = false;
        }
      }}
    />
  </Popover.Content>
</Popover.Root>
