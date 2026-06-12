<!-- Uber Eats wordmark glyph from Simple Icons (CC0 icon data). -->
<script lang="ts">
  import { siUbereats } from 'simple-icons';
  import SimpleBrandIcon from './SimpleBrandIcon.svelte';

  let { class: className = undefined }: { class?: string } = $props();
</script>

<SimpleBrandIcon icon={siUbereats} class={className} />
