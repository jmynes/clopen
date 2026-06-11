<!-- Renders a Font Awesome icon definition (the data-only icon packages) as
     an inline SVG in currentColor — lucide dropped brand icons, so brands
     come from @fortawesome/free-brands-svg-icons (icons CC BY 4.0) instead.
     No renderer dependency; the IconDefinition tuple is [w, h, , , path]. -->
<script lang="ts">
  import type { IconDefinition } from '@fortawesome/free-brands-svg-icons';

  let { icon, class: className = undefined }: { icon: IconDefinition; class?: string } = $props();

  const width = $derived(icon.icon[0]);
  const height = $derived(icon.icon[1]);
  const path = $derived(icon.icon[4]);
</script>

<svg viewBox="0 0 {width} {height}" fill="currentColor" class={className} aria-hidden="true">
  {#if Array.isArray(path)}
    {#each path as d (d)}
      <path {d} />
    {/each}
  {:else}
    <path d={path} />
  {/if}
</svg>
