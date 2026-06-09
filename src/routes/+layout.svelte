<script lang="ts">
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
  import Moon from '@lucide/svelte/icons/moon';
  import Sun from '@lucide/svelte/icons/sun';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';

  let { children } = $props();

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/log', label: 'Log' },
    { href: '/settings', label: 'Settings' },
  ];

  function isActive(href: string): boolean {
    return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
  }

  // Theme is applied by an inline script in app.html before paint. Sync the
  // local state from the resulting class on mount so the toggle reflects truth.
  let dark = $state(false);
  onMount(() => {
    dark = document.documentElement.classList.contains('dark');
  });
  function toggleTheme() {
    dark = !dark;
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch (_) {}
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Timesheet</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
  <header class="border-b border-border/70 bg-background/80 backdrop-blur sticky top-0 z-10">
    <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
      <a href="/" class="flex items-center gap-2 font-semibold tracking-tight">
        <CalendarClock class="size-5 text-primary" />
        <span>Timesheet</span>
      </a>
      <nav class="flex items-center gap-1 text-sm">
        {#each links as link (link.href)}
          <a
            href={link.href}
            class="rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground {isActive(
              link.href,
            )
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground'}"
            aria-current={isActive(link.href) ? 'page' : undefined}
          >
            {link.label}
          </a>
        {/each}
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-label="Toggle dark mode"
          onclick={toggleTheme}
          class="relative ml-2 inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border border-input bg-muted/50 transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Sun class="absolute left-1.5 size-3.5 text-amber-500" aria-hidden="true" />
          <Moon class="absolute right-1.5 size-3.5 text-sky-400" aria-hidden="true" />
          <span
            class="pointer-events-none inline-block size-5 transform rounded-full bg-background shadow ring-1 ring-border transition-transform {dark
              ? 'translate-x-8'
              : 'translate-x-1'}"
          ></span>
        </button>
      </nav>
    </div>
  </header>

  <main class="mx-auto max-w-5xl px-6 py-10">
    {@render children()}
  </main>
</div>
