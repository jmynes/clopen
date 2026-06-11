<!-- Uber badge glyph from the Font Awesome brands pack (CC BY 4.0). -->
<script lang="ts">
  import { faUber } from '@fortawesome/free-brands-svg-icons';
  import BrandIcon from './BrandIcon.svelte';

  let { class: className = undefined }: { class?: string } = $props();
</script>

<BrandIcon icon={faUber} class={className} />
