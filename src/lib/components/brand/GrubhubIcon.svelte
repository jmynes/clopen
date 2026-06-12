<!-- Grubhub glyph from Simple Icons (CC0 icon data). -->
<script lang="ts">
  import { siGrubhub } from 'simple-icons';
  import SimpleBrandIcon from './SimpleBrandIcon.svelte';

  let { class: className = undefined }: { class?: string } = $props();
</script>

<SimpleBrandIcon icon={siGrubhub} class={className} />
