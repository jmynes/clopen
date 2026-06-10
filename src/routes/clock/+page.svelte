<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<!-- Task 7 replaces this placeholder with the real punch UI. -->
<p class="text-sm text-muted-foreground">Clock state: {data.state}</p>
