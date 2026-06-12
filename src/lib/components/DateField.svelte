<!--
  A form date field that uses the same shadcn popover calendar as DateJump
  (not the browser's native date popup). The trigger reads like an <input>,
  showing the selected date; clicking it opens the month-grid calendar with
  month/year dropdowns floored at `min` and capped at `max`. A hidden input
  named `name` carries the ISO value for form submission, and every change
  dispatches a bubbling `input` event so native form dirty-tracking still sees
  it. `value` is bindable for callers that revert it (e.g. Settings → Cancel).
-->
<script lang="ts">
  import { DateFormatter, type DateValue, getLocalTimeZone, parseDate } from '@internationalized/date';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import { Button } from '$lib/components/ui/button';
  import { Calendar } from '$lib/components/ui/calendar';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';

  let {
    id = undefined,
    name,
    value = $bindable(''),
    min = undefined,
    max = undefined,
    placeholder = 'Pick a date',
    ariaInvalid = undefined,
    ariaDescribedby = undefined,
    class: className = undefined,
    onchange = undefined,
    shortcuts = undefined,
  }: {
    id?: string;
    name: string;
    value?: string;
    min?: string;
    max?: string;
    placeholder?: string;
    ariaInvalid?: 'true' | undefined;
    ariaDescribedby?: string;
    class?: string;
    onchange?: (iso: string) => void;
    /** Optional footer of one-tap picks ("Today", "This week", …); values clamp to min/max. */
    shortcuts?: Array<{ label: string; value: string }>;
  } = $props();

  const df = new DateFormatter('en-US', { dateStyle: 'medium' });

  function toDate(iso: string | undefined): DateValue | undefined {
    if (!iso) return undefined;
    try {
      return parseDate(iso);
    } catch {
      return undefined;
    }
  }

  const minValue = $derived(toDate(min));
  const maxValue = $derived(toDate(max));

  let open = $state(false);
  let selected = $state<DateValue | undefined>(undefined);
  let monthPlaceholder = $state<DateValue | undefined>(undefined);
  let hidden = $state<HTMLInputElement | null>(null);

  // Mirror the external value into the calendar; re-syncs when a caller resets
  // it (add-form reset, edit-dialog reopen, settings cancel).
  $effect(() => {
    const v = toDate(value);
    selected = v;
    monthPlaceholder = v ?? minValue ?? maxValue;
  });

  const displayText = $derived(selected ? df.format(selected.toDate(getLocalTimeZone())) : placeholder);

  function pickShortcut(iso: string) {
    let v = iso;
    if (min && v < min) v = min;
    if (max && v > max) v = max;
    value = v;
    // Let native form dirty-tracking / FormData observers notice the change.
    hidden?.dispatchEvent(new Event('input', { bubbles: true }));
    onchange?.(value);
    open = false;
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        {id}
        type="button"
        variant="outline"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        class={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
      >
        {displayText}
        <CalendarDays class="size-4 opacity-70" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-auto p-0" align="start">
    <Calendar
      type="single"
      bind:value={selected}
      bind:placeholder={monthPlaceholder}
      {minValue}
      {maxValue}
      captionLayout="dropdown"
      onValueChange={(v) => {
        if (!v) return;
        value = v.toString();
        // Let native form dirty-tracking / FormData observers notice the change.
        hidden?.dispatchEvent(new Event('input', { bubbles: true }));
        onchange?.(value);
        open = false;
      }}
    />
    {#if shortcuts?.length}
      <div class="flex flex-wrap gap-1.5 border-t border-border/60 p-2">
        {#each shortcuts as shortcut (shortcut.label)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="h-7 flex-1 whitespace-nowrap px-2 text-xs"
            onclick={() => pickShortcut(shortcut.value)}
          >
            {shortcut.label}
          </Button>
        {/each}
      </div>
    {/if}
  </Popover.Content>
</Popover.Root>

<input bind:this={hidden} type="hidden" {name} {value} />
