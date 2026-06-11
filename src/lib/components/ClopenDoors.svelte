<script lang="ts">
  import mark from '$lib/assets/clopen-doors-ampm.svg';

  let { class: className = '' }: { class?: string } = $props();
</script>

<!-- The two-tone Clopen doors mark. The colors live in the asset itself
     (src/lib/assets/clopen-doors-ampm.svg — PM sky left door, AM rose right
     door), which is also the basis of the favicon, so header and tab icon
     can never drift apart. -->
<img src={mark} alt="" class={className} aria-hidden="true" />
