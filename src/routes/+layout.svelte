<script lang="ts">
  import Clock from '@lucide/svelte/icons/clock';
  import FlaskConical from '@lucide/svelte/icons/flask-conical';
  import Gift from '@lucide/svelte/icons/gift';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import Moon from '@lucide/svelte/icons/moon';
  import NotebookPen from '@lucide/svelte/icons/notebook-pen';
  import PenLine from '@lucide/svelte/icons/pen-line';
  import Receipt from '@lucide/svelte/icons/receipt';
import Settings from '@lucide/svelte/icons/settings';
  import Sun from '@lucide/svelte/icons/sun';
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { page } from '$app/state';
  import favicon from '$lib/assets/favicon.svg';
  import DiscordIcon from '$lib/components/brand/DiscordIcon.svelte';
  import ClopenDoors from '$lib/components/ClopenDoors.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { isDemo } from '$lib/demo/flag';
  import '../app.css';

  let { children, data } = $props();

  // The five destinations that earn a slot in the phone's thumb zone. Settings
  // is deliberately not one of them: it's a place you visit rarely, so on
  // mobile it lives as a header icon (and in the hamburger) instead of
  // spending a fifth of the tab bar.
  const navLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/clock', label: 'Clock', icon: Clock },
    { href: '/log', label: 'Log', icon: NotebookPen },
    { href: '/expenses', label: 'Expenses', icon: Receipt },
    { href: '/bonuses', label: 'Bonuses', icon: Gift },
  ];
  const settingsLink = { href: '/settings', label: 'Settings', icon: Settings };
  // The hamburger is the one place Settings appears by name.
  const links = [...navLinks, settingsLink];

  const clockRunning = $derived(!!data.openShift);

  function isActive(href: string): boolean {
    return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
  }

  let menuOpen = $state(false);

  const year = new Date().getFullYear();

  // Theme is applied by an inline script in app.html before paint. Sync the
  // local state from the resulting class on mount so the toggle reflects truth.
  let dark = $state(false);

  // Demo data source: the sample timesheet (pre-seeded, in-use) vs. the
  // visitor's own blank-slate sandbox. Only surfaced on the demo build.
  let sampleData = $state(true);

  onMount(async () => {
    dark = document.documentElement.classList.contains('dark');
    // Demo mode renders client-side only (ssr = !isDemo in +layout.ts), so the
    // loads already saw localStorage — just sync the sample/yours toggle state.
    if (isDemo) {
      const { isSampleData } = await import('$lib/demo/repo');
      sampleData = isSampleData();
    }
  });
  function setTheme(next: boolean) {
    if (next === dark) return;
    dark = next;
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch (_) {}
  }
  async function setSample(next: boolean) {
    if (next === sampleData) return;
    sampleData = next;
    const { setSampleData } = await import('$lib/demo/repo');
    setSampleData(next);
    invalidate('demo:data');
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Clopen</title>
</svelte:head>

<Tooltip.Provider delayDuration={300}>
<div class="flex min-h-screen flex-col bg-background text-foreground">
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
          <ClopenDoors class="h-5 w-auto text-primary" />
          <span>Clopen</span>
        </a>
      </div>
      <nav class="flex items-center gap-1 text-sm">
        <div class="hidden items-center gap-1 md:flex">
          {#each navLinks as link (link.href)}
            {@const Icon = link.icon}
            <a
              href={link.href}
              class="nav-link relative flex items-center gap-1.5 px-3 py-1.5 transition-colors hover:text-foreground {isActive(
                link.href,
              )
                ? 'nav-link--active text-foreground font-medium'
                : 'text-muted-foreground'}"
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              <Icon class="size-4 {isActive(link.href) ? 'text-primary' : ''}" />
              {link.label}
              {#if link.href === '/clock' && clockRunning}
                <span class="absolute top-1 right-1 size-1.5 rounded-full bg-success" aria-hidden="true"></span>
              {/if}
            </a>
          {/each}
        </div>
        {#if isDemo}
          <div
            role="radiogroup"
            aria-label="Demo data"
            class="relative ml-2 inline-flex h-8 items-center rounded-full border border-input bg-muted/40 p-1"
          >
            <span
              aria-hidden="true"
              class="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm ring-1 ring-border transition-transform duration-300 ease-out {sampleData
                ? ''
                : 'translate-x-full'}"
            ></span>
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <label
                    {...props}
                    class="relative z-10 inline-flex h-6 w-9 cursor-pointer items-center justify-center rounded-full transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 {sampleData
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'}"
                  >
                    <input
                      type="radio"
                      name="demo-data"
                      class="sr-only"
                      checked={sampleData}
                      onchange={() => setSample(true)}
                    />
                    <FlaskConical class="size-4" />
                    <span class="sr-only">Sample timesheet</span>
                  </label>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>Sample timesheet — a populated demo</Tooltip.Content>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <label
                    {...props}
                    class="relative z-10 inline-flex h-6 w-9 cursor-pointer items-center justify-center rounded-full transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 {!sampleData
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'}"
                  >
                    <input
                      type="radio"
                      name="demo-data"
                      class="sr-only"
                      checked={!sampleData}
                      onchange={() => setSample(false)}
                    />
                    <PenLine class="size-4" />
                    <span class="sr-only">Your own data</span>
                  </label>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>Your own data — a blank sandbox</Tooltip.Content>
            </Tooltip.Root>
          </div>
        {/if}
        <!-- Settings is a rare destination, so at every width it's a cog beside
             the theme toggle rather than a labelled nav item: off the phone's
             tab bar, and out of the desktop header's link run. The hamburger
             still lists it by name. -->
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <a
                {...props}
                href={settingsLink.href}
                class="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground {isActive(
                  settingsLink.href,
                )
                  ? 'text-primary'
                  : 'text-muted-foreground'}"
                aria-label="Settings"
                aria-current={isActive(settingsLink.href) ? 'page' : undefined}
                onclick={() => (menuOpen = false)}
              >
                <Settings class="size-4" />
              </a>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Settings</Tooltip.Content>
        </Tooltip.Root>
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
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <label
                  {...props}
                  class="relative z-10 inline-flex h-6 w-9 cursor-pointer items-center justify-center rounded-full transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 {!dark
                    ? 'text-amber-600'
                    : 'text-muted-foreground hover:text-foreground'}"
                >
                  <input type="radio" name="theme" class="sr-only" checked={!dark} onchange={() => setTheme(false)} />
                  <Sun class="size-4" />
                  <span class="sr-only">Light mode</span>
                </label>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Light mode</Tooltip.Content>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <label
                  {...props}
                  class="relative z-10 inline-flex h-6 w-9 cursor-pointer items-center justify-center rounded-full transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 {dark
                    ? 'text-sky-300'
                    : 'text-muted-foreground hover:text-foreground'}"
                >
                  <input type="radio" name="theme" class="sr-only" checked={dark} onchange={() => setTheme(true)} />
                  <Moon class="size-4" />
                  <span class="sr-only">Dark mode</span>
                </label>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Dark mode</Tooltip.Content>
          </Tooltip.Root>
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
      <!-- One grid for the whole panel so the rows share column tracks: an
           icon column, a label column sized to the longest label, and equal
           `1fr` gutters either side that centre the pair. Each row is a
           `subgrid` spanning all four, which keeps it a full-width box (tap
           target, hover fill, divider, the clock dot) while its contents line
           up with every other row. Sizing the label column to content is what
           stops the block from carrying dead space on one side. -->
      <div
        class="fixed inset-x-0 top-14 z-20 grid grid-cols-[1fr_1rem_auto_1fr] gap-x-2 divide-y divide-border/60 border-t border-border/70 bg-background px-4 pb-2 md:hidden"
      >
        {#each links as link (link.href)}
          {@const Icon = link.icon}
          <a
            href={link.href}
            class="relative col-span-4 grid min-h-12 select-none grid-cols-subgrid items-center text-sm transition-colors {isActive(
              link.href,
            )
              ? 'bg-primary/10 font-medium text-foreground hover:bg-primary/15'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
            aria-current={isActive(link.href) ? 'page' : undefined}
            onclick={() => (menuOpen = false)}
          >
            <!-- The current page is called out four ways at once — accent bar,
                 tinted row, full-strength text, primary icon — because the menu
                 covers the page you'd otherwise recognise, so weight alone is
                 too quiet to answer "where am I?". -->
            {#if isActive(link.href)}
              <span class="absolute inset-y-0 left-0 w-1 rounded-r-sm bg-primary" aria-hidden="true"></span>
            {/if}
            <Icon class="col-start-2 size-4 {isActive(link.href) ? 'text-primary' : ''}" />
            <span class="col-start-3">{link.label}</span>
            {#if link.href === '/clock' && clockRunning}
              <span class="absolute top-1 right-1 size-1.5 rounded-full bg-success" aria-hidden="true"></span>
            {/if}
          </a>
        {/each}
      </div>
    {/if}
  </header>

  <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:px-6 md:py-10 md:pb-10">
    {@render children()}
  </main>

  <!-- Desktop footer; phones get the tab bar instead. flex-1 on main keeps it
       pinned to the viewport bottom even when a page runs short. -->
  <footer class="hidden border-t border-border/70 md:block">
    <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-1.5 text-xs text-muted-foreground">
      <a
        href="https://mynes.me"
        target="_blank"
        rel="noopener noreferrer"
        class="-ml-2 rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        🄯 {year} Jordan Mynes
      </a>
      <span class="ml-auto mr-1 font-mono text-xs" title="App version">v{__APP_VERSION__}</span>
      <a
        href="https://github.com/jmynes/clopen"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <!-- GitHub mark (lucide dropped brand icons) -->
        <svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5" aria-hidden="true">
          <path
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
          />
        </svg>
        GitHub
      </a>
      <a
        href="https://discord.gg/DAmnh27qna"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <DiscordIcon class="size-3.5" />
        Discord
      </a>
    </div>
  </footer>

  <!-- iOS-style tab bar replaces the header links on phones -->
  <nav
    aria-label="Primary"
    class="fixed inset-x-0 bottom-0 z-10 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
  >
    <div class="grid grid-cols-5">
      {#each navLinks as link (link.href)}
        {@const Icon = link.icon}
        <a
          href={link.href}
          class="relative flex flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors {isActive(
            link.href,
          )
            ? 'text-primary hover:bg-accent/40'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}"
          aria-current={isActive(link.href) ? 'page' : undefined}
        >
          <Icon class="size-5" />
          {link.label}
          {#if link.href === '/clock' && clockRunning}
            <span class="absolute top-1 right-1 size-1.5 rounded-full bg-success" aria-hidden="true"></span>
          {/if}
        </a>
      {/each}
    </div>
  </nav>
</div>
</Tooltip.Provider>

<style>
  /* Desktop nav underline: sweeps in from the left on hover, retracts to
     the right on leave; the active link keeps it drawn. Same idiom as
     hexhive's header nav. */
  .nav-link::after {
    content: '';
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 0;
    height: 2px;
    background: var(--primary);
    transform: scaleX(0);
    transform-origin: right;
    transition: transform 0.25s ease;
  }
  .nav-link--active::after {
    transform: scaleX(1);
  }
  .nav-link:hover::after {
    transform: scaleX(1);
    transform-origin: left;
  }

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
