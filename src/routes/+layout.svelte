<script lang="ts">
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import Moon from '@lucide/svelte/icons/moon';
  import NotebookPen from '@lucide/svelte/icons/notebook-pen';
  import Settings from '@lucide/svelte/icons/settings';
  import Sun from '@lucide/svelte/icons/sun';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';

  let { children } = $props();

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/log', label: 'Log', icon: NotebookPen },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  function isActive(href: string): boolean {
    return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
  }

  let menuOpen = $state(false);

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
  <title>Clopen</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
  <header class="border-b border-border/70 bg-background/80 backdrop-blur sticky top-0 z-20">
    <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:h-auto md:px-6 md:py-4">
      <div class="flex items-center gap-1">
        <!-- Mobile hamburger (animated bars → X) -->
        <button
          type="button"
          class="-ml-2 flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-md transition-colors hover:bg-accent active:bg-accent md:hidden"
          onclick={() => (menuOpen = !menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span class="hamburger-bar {menuOpen ? 'translate-y-[7px] rotate-45' : ''}"></span>
          <span class="hamburger-bar {menuOpen ? 'opacity-0' : ''}"></span>
          <span class="hamburger-bar {menuOpen ? '-translate-y-[7px] -rotate-45' : ''}"></span>
        </button>
        <a href="/" class="flex items-center gap-2 font-semibold tracking-tight" onclick={() => (menuOpen = false)}>
          <CalendarClock class="size-5 text-primary" />
          <span>Clopen</span>
        </a>
      </div>
      <nav class="flex items-center gap-1 text-sm">
        <div class="hidden items-center gap-1 md:flex">
          {#each links as link (link.href)}
            {@const Icon = link.icon}
            <a
              href={link.href}
              class="flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground {isActive(
                link.href,
              )
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground'}"
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              <Icon class="size-4 {isActive(link.href) ? 'text-primary' : ''}" />
              {link.label}
            </a>
          {/each}
        </div>
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

    <!-- Mobile menu: overlay + slide-down panel below the h-14 header -->
    {#if menuOpen}
      <!-- h is explicit: Chrome won't stretch an abs-positioned <button> from top/bottom constraints -->
      <button
        type="button"
        class="fixed inset-x-0 top-14 z-10 h-[calc(100dvh-3.5rem)] cursor-default bg-black/75 md:hidden"
        onclick={() => (menuOpen = false)}
        aria-label="Close menu"
        tabindex={-1}
      ></button>
      <div
        class="fixed inset-x-0 top-14 z-20 divide-y divide-border/60 border-t border-border/70 bg-background px-4 pb-2 md:hidden"
      >
        {#each links as link (link.href)}
          {@const Icon = link.icon}
          <a
            href={link.href}
            class="flex min-h-12 select-none items-center justify-center gap-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground {isActive(
              link.href,
            )
              ? 'font-medium'
              : 'text-muted-foreground'}"
            aria-current={isActive(link.href) ? 'page' : undefined}
            onclick={() => (menuOpen = false)}
          >
            <Icon class="size-4 {isActive(link.href) ? 'text-primary' : ''}" />
            {link.label}
          </a>
        {/each}
      </div>
    {/if}
  </header>

  <main class="mx-auto max-w-5xl px-4 py-6 pb-24 md:px-6 md:py-10 md:pb-10">
    {@render children()}
  </main>

  <!-- iOS-style tab bar replaces the header links on phones -->
  <nav
    aria-label="Primary"
    class="fixed inset-x-0 bottom-0 z-10 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
  >
    <div class="grid grid-cols-3">
      {#each links as link (link.href)}
        {@const Icon = link.icon}
        <a
          href={link.href}
          class="flex flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors {isActive(
            link.href,
          )
            ? 'text-primary hover:bg-accent/40'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}"
          aria-current={isActive(link.href) ? 'page' : undefined}
        >
          <Icon class="size-5" />
          {link.label}
        </a>
      {/each}
    </div>
  </nav>
</div>

<style>
  /* Same animated hamburger as hexhive/punt: three bars that morph into an X. */
  .hamburger-bar {
    width: 1.25rem;
    height: 2px;
    border-radius: 1px;
    background: currentColor;
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
    transform-origin: center;
  }
</style>
