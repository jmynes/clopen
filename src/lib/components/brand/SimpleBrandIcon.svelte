<!-- Renders a Simple Icons definition as an inline SVG in currentColor —
     the sibling of BrandIcon for brands Font Awesome doesn't carry.
     Simple Icons paths are always drawn on a 24×24 viewBox.
     Pinned to simple-icons@14, the last release carrying Grubhub. -->
<script lang="ts">
  import type { SimpleIcon } from 'simple-icons';

  let { icon, class: className = undefined }: { icon: SimpleIcon; class?: string } = $props();
</script>

<svg viewBox="0 0 24 24" fill="currentColor" class={className} aria-hidden="true">
  <path d={icon.path} />
</svg>
