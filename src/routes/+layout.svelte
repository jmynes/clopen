<script lang="ts">
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
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
      </nav>
    </div>
  </header>

  <main class="mx-auto max-w-5xl px-6 py-10">
    {@render children()}
  </main>
</div>
