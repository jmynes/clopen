<!-- Grubhub's brandmark — the house-with-cutlery it shares with parent
     Just Eat Takeaway since the 2021 rebrand. Simple Icons carries the
     glyph under Just Eat (its own Grubhub entry was the wordmark, and was
     dropped after v14); the red tint at the call site makes it Grubhub's. -->
<script lang="ts">
  import { siJusteat } from 'simple-icons';
  import SimpleBrandIcon from './SimpleBrandIcon.svelte';

  let { class: className = undefined }: { class?: string } = $props();
</script>

<SimpleBrandIcon icon={siJusteat} class={className} />
