<!-- Grubhub's actual app icon (fetched from grubhub.com/apple-touch-icon.png).
     No pack carries a Grubhub-specific mark — Simple Icons only has the
     house-with-cutlery it shares with parent Just Eat Takeaway — so the
     genuine 2KB raster rides along in assets instead of the look-alike.
     Decorative: label text sits beside it everywhere it renders. -->
<script lang="ts">
  import icon from '$lib/assets/grubhub-app-icon.png';

  let { class: className = undefined }: { class?: string } = $props();
</script>

<img src={icon} alt="" aria-hidden="true" class="rounded-[3px] {className}" />
