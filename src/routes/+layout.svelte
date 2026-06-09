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
  function setTheme(next: boolean) {
    if (next === dark) return;
    dark = next;
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
    <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
      <a href="/" class="flex items-center gap-2 font-semibold tracking-tight">
        <CalendarClock class="size-5 text-primary" />
        <span class="hidden sm:inline">Timesheet</span>
      </a>
      <nav class="flex items-center gap-1 text-sm">
        {#each links as link (link.href)}
          <a
            href={link.href}
            class="rounded-md px-2 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3 {isActive(
              link.href,
            )
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground'}"
            aria-current={isActive(link.href) ? 'page' : undefined}
          >
            {link.label}
          </a>
        {/each}
        <div
          role="radiogroup"
          aria-label="Theme"
          class="relative ml-2 inline-flex h-8 items-center rounded-full border border-input bg-muted/40 p-1"
        >
          <span
            aria-hidden="true"
            class="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm ring-1 ring-border transition-transform duration-300 ease-out {dark
              ? 'translate-x-full'
              : ''}"
          ></span>
          <button
            type="button"
            role="radio"
            aria-checked={!dark}
            aria-label="Light mode"
            onclick={() => setTheme(false)}
            class="relative z-10 inline-flex h-6 w-9 items-center justify-center rounded-full transition-colors {!dark
              ? 'text-amber-600'
              : 'text-muted-foreground hover:text-foreground'}"
          >
            <Sun class="size-4" />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={dark}
            aria-label="Dark mode"
            onclick={() => setTheme(true)}
            class="relative z-10 inline-flex h-6 w-9 items-center justify-center rounded-full transition-colors {dark
              ? 'text-sky-300'
              : 'text-muted-foreground hover:text-foreground'}"
          >
            <Moon class="size-4" />
          </button>
        </div>
      </nav>
    </div>
  </header>

  <main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
    {@render children()}
  </main>
</div>
