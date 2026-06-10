<script lang="ts">
  let { class: className = '' }: { class?: string } = $props();
</script>

<!-- The Clopen doors mark (see src/lib/assets/clopen-doors.svg / design/).
     Inlined so CSS theming works; knobs are evenodd holes. A hard-stop
     gradient splits the mark down the middle — left door wears the ledger's
     PM color (sky), right door the AM color (rose) — with currentColor on
     the stops so each follows its dark-mode text class. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 262 378" class={className} aria-hidden="true">
  <defs>
    <linearGradient id="clopen-ampm" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.5" class="text-sky-500 dark:text-sky-400" stop-color="currentColor" />
      <stop offset="0.5" class="text-rose-500 dark:text-rose-400" stop-color="currentColor" />
    </linearGradient>
  </defs>
  <path fill="url(#clopen-ampm)" fill-rule="evenodd" d="M179.5 23.3C135.0 35.6 96.8 46.2 94.8 46.7L91.0 47.8L91.0 69.3L91.0 90.9L88.3 90.3C86.7 89.9 66.8 84.4 43.9 78.1C21.0 71.8 2.0 66.7 1.6 66.7C1.3 66.7 1.0 136.4 1.0 221.7C1.0 306.9 1.1 376.7 1.3 376.6C1.4 376.6 39.5 366.4 86.0 353.9L170.5 331.1L170.8 309.0L171.0 286.9L176.8 288.4C179.9 289.2 200.0 294.6 221.4 300.3C242.8 306.1 260.4 310.6 260.6 310.4C260.8 310.2 260.9 240.5 260.8 155.5L260.5 1.0L179.5 23.3ZM202.8 36.0L160.0 56.2L160.3 155.6L160.5 254.9L196.8 273.7C234.8 293.3 236.3 294.2 230.9 292.7C213.8 288.1 117.7 262.4 115.2 261.7L111.9 260.8L112.2 266.0L112.5 271.1L135.7 277.3C148.4 280.7 159.3 283.8 159.9 284.1C161.6 285.2 161.4 322.2 159.8 323.4C158.3 324.5 30.0 359.0 29.4 358.4C29.2 358.3 45.5 349.6 65.5 339.2L102.0 320.4L101.8 221.0L101.5 121.6L59.9 101.9C36.9 91.1 18.5 82.1 18.9 81.9C19.3 81.8 35.4 86.0 54.6 91.2C133.1 112.8 147.3 116.7 148.1 116.7C148.6 116.7 149.0 114.5 149.0 111.9L149.0 107.0L125.3 100.5L101.5 94.0L101.2 75.2C101.1 64.8 101.3 56.0 101.8 55.5C102.7 54.6 241.3 15.9 244.0 15.8C244.8 15.8 226.3 24.8 202.8 36.0ZM188.5 143.3C196.5 151.9 185.0 166.4 176.8 158.2C173.5 154.9 172.6 150.5 174.4 146.2C177.0 140.1 184.2 138.6 188.5 143.3ZM82.7 209.1C85.1 211.2 85.5 212.3 85.5 216.5C85.5 225.7 77.8 229.9 71.3 224.3C65.0 218.9 69.0 206.7 77.0 206.7C78.6 206.7 81.1 207.8 82.7 209.1Z" />
</svg>
