<!--
  A compact "jump to date" control for the date-navigation bars (dashboard
  period nav, week grid, ledger). It's a calendar-icon button that opens the
  browser's native date picker — the same control the Add-an-entry date field
  uses — via showPicker(), so picking a day fires `onpick` with its ISO string.
  The native <input type="date"> sits invisibly over the button so the picker
  anchors to it while the button takes the clicks.
-->
<script lang="ts">
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import { Button } from '$lib/components/ui/button';

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

  let input = $state<HTMLInputElement | null>(null);

  function open() {
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // Browsers without showPicker (or that block it) still open on click/focus.
      input.focus();
      input.click();
    }
  }
</script>

<div class="relative shrink-0">
  <Button type="button" variant="outline" size="icon" title={label} aria-label={label} onclick={open}>
    <CalendarDays class="size-4" />
  </Button>
  <input
    bind:this={input}
    type="date"
    {value}
    {min}
    {max}
    tabindex="-1"
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 size-full opacity-0"
    onchange={(e) => {
      const v = e.currentTarget.value;
      if (v) onpick(v);
    }}
  />
</div>
