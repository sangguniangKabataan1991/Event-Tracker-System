<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { user, logout, token, API, openProfileEdit, updateUser } from '$lib/api.js';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import LayoutDashboard from 'lucide-svelte/icons/layout-dashboard';
  import ClipboardList   from 'lucide-svelte/icons/clipboard-list';
  import FileText        from 'lucide-svelte/icons/file-text';
  import Users           from 'lucide-svelte/icons/users';
  import BarChart2       from 'lucide-svelte/icons/bar-chart-2';
  import Settings        from 'lucide-svelte/icons/settings';
  import LogOut          from 'lucide-svelte/icons/log-out';
  import ChevronLeft     from 'lucide-svelte/icons/chevron-left';
  import ChevronRight    from 'lucide-svelte/icons/chevron-right';
  import Menu            from 'lucide-svelte/icons/menu';
  import X               from 'lucide-svelte/icons/x';
  import ShieldAlert     from 'lucide-svelte/icons/shield-alert';
  import Pencil          from 'lucide-svelte/icons/pencil';
  import Camera          from 'lucide-svelte/icons/camera';

  let { children }: { children: Snippet } = $props();
  let collapsed  = $state(false);
  let mobileOpen = $state(false);

  // ── Avatar upload state ────────────────────────────────────────────────────
  let uploadingAvatar = $state(false);
  let avatarError     = $state('');
  let fileInputRef    = $state<HTMLInputElement | undefined>(undefined);

  const STAFF_ROUTES = ['/', '/programs', '/applications', '/beneficiaries', '/search', '/reports'];

  onMount(() => {
    const path = $page.url.pathname as string;
    if (!$user && path !== '/login') { goto('/login'); return; }
    const role = ($user as any)?.role;
    if (role === 'staff' && !STAFF_ROUTES.some(r => path === r || path.startsWith(r + '/'))) {
      goto('/');
    }
  });

  const allNav = [
    { href: '/',              icon: LayoutDashboard, label: 'Dashboard',     roles: ['admin', 'staff'] },
    { href: '/programs',      icon: ClipboardList,   label: 'Programs',      roles: ['admin', 'staff'] },
    { href: '/applications',  icon: FileText,        label: 'Applications',  roles: ['admin', 'staff'] },
    { href: '/beneficiaries', icon: Users,           label: 'Beneficiaries', roles: ['admin', 'staff'] },
    { href: '/reports',       icon: BarChart2,       label: 'Reports',       roles: ['admin', 'staff'] },
    { href: '/settings',      icon: Settings,        label: 'Settings',      roles: ['admin'] },
  ];

  let nav = $derived(
    allNav.filter(item => item.roles.includes(($user as any)?.role ?? ''))
  );

  function handleLogout() { logout(); goto('/login'); }
  function closeMobile()  { mobileOpen = false; }

  function handleProfileClick() {
    closeMobile();
    openProfileEdit.set(true);
    if (($page.url.pathname as string) !== '/settings') goto('/settings');
  }

  let currentRole     = $derived(($user as any)?.role     ?? '');
  let currentPosition = $derived(($user as any)?.position ?? '');
  let avatarUrl       = $derived(($user as any)?.avatar_url ?? null);

  let positionLabel = $derived(
    currentPosition ? currentPosition
      : currentRole === 'admin' ? 'SK Chairperson' : 'SK Staff'
  );

  let roleBadgeColor = $derived(
    currentRole === 'admin'
      ? 'bg-purple-500/20 text-purple-200'
      : 'bg-blue-500/20 text-blue-200'
  );

  function getInitial(name: string) {
    return (name || 'A').charAt(0).toUpperCase();
  }

  // ── Avatar upload ──────────────────────────────────────────────────────────
  async function handleAvatarChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    avatarError     = '';
    uploadingAvatar = true;

    try {
      const t  = get(token);
      const fd = new FormData();
      fd.append('avatar', file);

      const res = await fetch(`${API}/users/me/avatar`, {
        method:  'POST',
        headers: t ? { Authorization: `Bearer ${t}` } : {},
        body:    fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      updateUser({ avatar_url: data.avatar_url });
    } catch (err) {
      avatarError = err instanceof Error ? err.message : 'Upload failed';
      setTimeout(() => avatarError = '', 4000);
    } finally {
      uploadingAvatar = false;
      if (fileInputRef) fileInputRef.value = '';
    }
  }
</script>

{#if ($page.url.pathname as string) === '/login'
  || ($page.url.pathname as string) === '/forgot-password'
  || ($page.url.pathname as string) === '/reset-password'}
  {@render children()}
{:else if $user}
  <div class="flex h-screen overflow-hidden" style="background:#F5F7FA;">

    <!-- Mobile overlay backdrop -->
    {#if mobileOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="fixed inset-0 z-40 bg-black/50 lg:hidden" onclick={closeMobile}></div>
    {/if}

    <!-- ── Sidebar ─────────────────────────────────────────────────────────── -->
    <aside
      class="
        fixed inset-y-0 left-0 z-50 flex flex-col shrink-0
        transition-all duration-300 ease-in-out
        {mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:static lg:translate-x-0
        {collapsed ? 'lg:w-17.5' : 'lg:w-60'}
        w-64
      "
      style="background:#0A1F44;"
    >
      <!-- Logo -->
      <div class="flex items-center px-4 py-4 border-b border-white/10
                  {collapsed ? 'lg:justify-center' : 'justify-between'}">
        {#if !collapsed}
          <div class="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="SK Logo" class="w-11 h-11 object-contain shrink-0 drop-shadow-md" />
            <span class="text-xs font-bold text-white leading-snug">
              SK Beneficiary<br/>Tracking and<br/>Management System
            </span>
          </div>
        {:else}
          <img src="/logo.png" alt="SK Logo" class="w-10 h-10 object-contain drop-shadow-md hidden lg:block" />
          <div class="flex items-center gap-3 min-w-0 lg:hidden">
            <img src="/logo.png" alt="SK Logo" class="w-11 h-11 object-contain shrink-0 drop-shadow-md" />
            <span class="text-xs font-bold text-white leading-snug">
              SK Beneficiary<br/>Tracking and<br/>Management System
            </span>
          </div>
        {/if}

        <button
          onclick={() => collapsed = !collapsed}
          class="p-1.5 rounded-lg transition text-white/40 hover:text-white hover:bg-white/10 shrink-0 hidden lg:flex
                 {collapsed ? 'hidden!' : ''}"
        >
          <ChevronLeft size={15} />
        </button>

        <button onclick={closeMobile} class="p-1.5 rounded-lg transition text-white/40 hover:text-white hover:bg-white/10 lg:hidden">
          <X size={18} />
        </button>
      </div>

      {#if collapsed}
        <button
          onclick={() => collapsed = !collapsed}
          class="mx-auto mt-3 p-1.5 rounded-lg transition text-white/40 hover:text-white hover:bg-white/10 hidden lg:flex"
        >
          <ChevronRight size={15} />
        </button>
      {/if}

      {#if !collapsed}
        <div class="px-5 pt-5 pb-1">
          <span class="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Menu</span>
        </div>
      {/if}

      <!-- Nav links -->
      <nav class="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {#each nav as item}
          {@const active = ($page.url.pathname as string) === item.href}
          <a
            href={item.href}
            onclick={closeMobile}
            title={collapsed ? item.label : ''}
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                   {collapsed ? 'lg:justify-center' : ''}
                   {active ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}"
            style={active ? 'background:rgba(255,255,255,0.15);' : ''}
          >
            <item.icon size={18} class="shrink-0" />
            <span class="{collapsed ? 'lg:hidden' : ''}">{item.label}</span>
          </a>
        {/each}
      </nav>

      <!-- ── Account section ────────────────────────────────────────────────── -->
      <div class="px-3 pb-4 border-t border-white/10 pt-3 space-y-2">

        {#if !collapsed}
          <div class="px-2 pb-1">
            <span class="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Account</span>
          </div>
        {/if}

        <!-- Hidden file input for avatar -->
        <input
          type="file"
          accept="image/*"
          class="hidden"
          bind:this={fileInputRef}
          onchange={handleAvatarChange}
        />

        <!-- ── Expanded sidebar ── -->
        {#if !collapsed}
          {#if currentRole === 'admin'}
            <div class="px-3 py-3 rounded-xl space-y-2" style="background:rgba(255,255,255,0.08);">
              <!-- Avatar row -->
              <div class="flex items-center gap-3">
                <!-- Clickable avatar with camera overlay -->
                <div class="relative group shrink-0">
                  <div class="w-10 h-10 rounded-full overflow-hidden">
                    {#if avatarUrl}
                      <img src={avatarUrl} alt="Profile" class="w-full h-full object-cover" />
                    {:else}
                      <div
                        class="w-full h-full flex items-center justify-center text-sm font-bold text-white"
                        style="background:rgba(255,255,255,0.15);"
                      >
                        {getInitial(($user as any)?.full_name)}
                      </div>
                    {/if}
                  </div>

                  <button
                    onclick={() => fileInputRef?.click()}
                    disabled={uploadingAvatar}
                    class="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style="background:rgba(0,0,0,0.55);"
                    title="Change photo"
                  >
                    {#if uploadingAvatar}
                      <div
                        class="w-3.5 h-3.5 border-2 border-white/30 rounded-full"
                        style="border-top-color:white; animation:spin 0.8s linear infinite;"
                      ></div>
                    {:else}
                      <Camera size={12} class="text-white" />
                    {/if}
                  </button>
                </div>

                <!-- Name + edit profile -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1 mb-0.5">
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full truncate max-w-24 {roleBadgeColor}">
                      {positionLabel}
                    </span>
                  </div>
                  <div class="text-xs font-semibold text-white truncate">{($user as any).full_name}</div>
                  <div class="text-[10px] text-white/30 truncate">@{($user as any).username}</div>
                </div>

                <!-- Edit profile button -->
                <button
                  onclick={handleProfileClick}
                  class="p-1.5 rounded-lg shrink-0 transition text-white/30 hover:text-white hover:bg-white/10"
                  title="Edit profile"
                >
                  <Pencil size={12} />
                </button>
              </div>

              {#if avatarError}
                <div class="text-[10px] rounded-lg px-2 py-1.5" style="background:rgba(220,38,38,0.2); color:#fca5a5;">
                  {avatarError}
                </div>
              {/if}
            </div>

          {:else}
            <!-- Staff: show avatar but no edit -->
            <div class="px-3 py-3 rounded-xl space-y-2" style="background:rgba(255,255,255,0.08);">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full overflow-hidden shrink-0">
                  {#if avatarUrl}
                    <img src={avatarUrl} alt="Profile" class="w-full h-full object-cover" />
                  {:else}
                    <div
                      class="w-full h-full flex items-center justify-center text-sm font-bold text-white"
                      style="background:rgba(255,255,255,0.15);"
                    >
                      {getInitial(($user as any)?.full_name)}
                    </div>
                  {/if}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1 mb-0.5">
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full {roleBadgeColor}">
                      {positionLabel}
                    </span>
                  </div>
                  <div class="text-xs font-semibold text-white truncate">{($user as any).full_name}</div>
                  <div class="text-[10px] text-white/30 truncate">@{($user as any).username}</div>
                </div>
                <!-- Staff can also upload their own avatar -->
                <button
                  onclick={() => fileInputRef?.click()}
                  disabled={uploadingAvatar}
                  class="p-1.5 rounded-lg shrink-0 transition text-white/30 hover:text-white hover:bg-white/10"
                  title="Change photo"
                >
                  <Camera size={12} />
                </button>
              </div>
            </div>
          {/if}

        <!-- ── Collapsed sidebar (desktop) ── -->
        {:else}
          <div class="justify-center py-1 hidden lg:flex">
            <div class="relative group">
              <button
                onclick={currentRole === 'admin' ? handleProfileClick : () => fileInputRef?.click()}
                class="block w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-white/40 transition"
                title={currentRole === 'admin' ? 'Edit profile' : 'Change photo'}
              >
                {#if avatarUrl}
                  <img src={avatarUrl} alt="Profile" class="w-full h-full object-cover" />
                {:else}
                  <div
                    class="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                    style="background:rgba(255,255,255,0.15);"
                  >
                    {getInitial(($user as any)?.full_name)}
                  </div>
                {/if}
              </button>
            </div>
          </div>

          <!-- Mobile collapsed → show full card -->
          <div class="px-3 py-3 rounded-xl lg:hidden" style="background:rgba(255,255,255,0.08);">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full overflow-hidden shrink-0">
                {#if avatarUrl}
                  <img src={avatarUrl} alt="Profile" class="w-full h-full object-cover" />
                {:else}
                  <div
                    class="w-full h-full flex items-center justify-center text-sm font-bold text-white"
                    style="background:rgba(255,255,255,0.15);"
                  >
                    {getInitial(($user as any)?.full_name)}
                  </div>
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-white truncate">{($user as any).full_name}</div>
                <div class="text-[10px] text-white/30 truncate">@{($user as any).username}</div>
              </div>
              {#if currentRole === 'admin'}
                <button onclick={handleProfileClick} class="p-1.5 rounded-lg text-white/30 hover:text-white transition">
                  <Pencil size={12} />
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Staff restriction notice -->
        {#if !collapsed && currentRole === 'staff'}
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] text-white/40"
               style="background:rgba(255,255,255,0.05);">
            <ShieldAlert size={12} class="shrink-0 text-white/30" />
            Settings restricted to Admin only
          </div>
        {/if}

        <!-- Sign out -->
        <button
          onclick={handleLogout}
          title={collapsed ? 'Sign out' : ''}
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition
                 text-white/60 hover:bg-red-500/20 hover:text-red-300
                 {collapsed ? 'lg:justify-center' : ''}"
        >
          <LogOut size={16} class="shrink-0" />
          <span class="{collapsed ? 'lg:hidden' : ''}">Sign out</span>
        </button>

      </div>
    </aside>

    <!-- ── Main content ──────────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

      <!-- Mobile top bar -->
      <header class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white lg:hidden shrink-0">
        <button
          onclick={() => mobileOpen = true}
          class="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
        >
          <Menu size={20} />
        </button>
        <div class="flex items-center gap-2 min-w-0">
          <img src="/logo.png" alt="SK Logo" class="w-7 h-7 object-contain" />
          <span class="text-sm font-bold text-gray-800 truncate">SK BTMS</span>
        </div>
        <!-- Mobile top bar avatar -->
        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-gray-400 truncate max-w-24 hidden sm:block">
            {($user as any)?.full_name}
          </span>
          <div class="w-7 h-7 rounded-full overflow-hidden shrink-0">
            {#if avatarUrl}
              <img src={avatarUrl} alt="Profile" class="w-full h-full object-cover" />
            {:else}
              <div
                class="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                style="background:#0A1F44;"
              >
                {getInitial(($user as any)?.full_name)}
              </div>
            {/if}
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto" style="background:#F5F7FA;">
        {@render children()}
      </main>
    </div>
  </div>
{/if}

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>