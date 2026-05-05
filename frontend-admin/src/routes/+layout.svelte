<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { user, logout, apiFetch } from '$lib/api.js';
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
  import ShieldAlert     from 'lucide-svelte/icons/shield-alert';
  import X               from 'lucide-svelte/icons/x';
  import Eye             from 'lucide-svelte/icons/eye';
  import EyeOff          from 'lucide-svelte/icons/eye-off';
  import Save            from 'lucide-svelte/icons/save';
  import User            from 'lucide-svelte/icons/user';
  import Lock            from 'lucide-svelte/icons/lock';
  import Mail            from 'lucide-svelte/icons/mail';
  import Pencil          from 'lucide-svelte/icons/pencil';

  let { children }: { children: Snippet } = $props();
  let collapsed = $state(false);

  // ── Account Edit Modal ─────────────────────────────────────────────────────
  let showAccountModal  = $state(false);
  let accountForm       = $state({ full_name: '', email: '' });
  let passwordForm      = $state({ current: '', newPass: '', confirm: '' });
  let showCurrent       = $state(false);
  let showNew           = $state(false);
  let showConfirm       = $state(false);
  let accountLoading    = $state(false);
  let accountError      = $state('');
  let accountSuccess    = $state('');
  let activeTab         = $state<'profile' | 'password'>('profile');

  function openAccountModal() {
    accountForm  = { full_name: ($user as any)?.full_name ?? '', email: ($user as any)?.email ?? '' };
    passwordForm = { current: '', newPass: '', confirm: '' };
    accountError = '';
    accountSuccess = '';
    activeTab = 'profile';
    showCurrent = false;
    showNew = false;
    showConfirm = false;
    showAccountModal = true;
  }

  async function saveProfile() {
    if (!accountForm.full_name.trim()) {
      accountError = 'Full name is required.';
      return;
    }
    accountLoading = true;
    accountError = '';
    accountSuccess = '';
    try {
      await apiFetch(`/users/${($user as any).id}`, {
        method: 'PUT',
        body: { full_name: accountForm.full_name.trim(), email: accountForm.email.trim(), position: ($user as any)?.position }
      });
      // Update local user store
      user.update(u => u ? { ...u, full_name: accountForm.full_name.trim(), email: accountForm.email.trim() } : u);
      localStorage.setItem('sk_user', JSON.stringify({ ...($user as any), full_name: accountForm.full_name.trim(), email: accountForm.email.trim() }));
      accountSuccess = 'Profile updated successfully!';
      setTimeout(() => accountSuccess = '', 3000);
    } catch (e) {
      accountError = e instanceof Error ? e.message : 'Failed to update profile';
    } finally {
      accountLoading = false;
    }
  }

  async function savePassword() {
    accountError = '';
    accountSuccess = '';
    if (!passwordForm.current) { accountError = 'Current password is required.'; return; }
    if (passwordForm.newPass.length < 6) { accountError = 'New password must be at least 6 characters.'; return; }
    if (passwordForm.newPass !== passwordForm.confirm) { accountError = 'New passwords do not match.'; return; }

    accountLoading = true;
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: { current_password: passwordForm.current, new_password: passwordForm.newPass }
      });
      passwordForm = { current: '', newPass: '', confirm: '' };
      accountSuccess = 'Password changed successfully!';
      setTimeout(() => accountSuccess = '', 3000);
    } catch (e) {
      accountError = e instanceof Error ? e.message : 'Failed to change password';
    } finally {
      accountLoading = false;
    }
  }

  // Pages accessible to non-admin staff
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
    { href: '/',              icon: LayoutDashboard, label: 'Dashboard',      roles: ['admin', 'staff'] },
    { href: '/programs',      icon: ClipboardList,   label: 'Programs',       roles: ['admin', 'staff'] },
    { href: '/applications',  icon: FileText,        label: 'Applications',   roles: ['admin', 'staff'] },
    { href: '/beneficiaries', icon: Users,           label: 'Beneficiaries',  roles: ['admin', 'staff'] },
    { href: '/reports',       icon: BarChart2,       label: 'Reports',        roles: ['admin', 'staff'] },
    { href: '/settings',      icon: Settings,        label: 'Settings',       roles: ['admin'] },
  ];

  let nav = $derived(
    allNav.filter(item => item.roles.includes(($user as any)?.role ?? ''))
  );

  function handleLogout() {
    logout();
    goto('/login');
  }

  let currentRole     = $derived(($user as any)?.role     ?? '');
  let currentPosition = $derived(($user as any)?.position ?? '');

  let positionLabel = $derived(
    currentPosition
      ? currentPosition
      : currentRole === 'admin'
        ? 'SK Chairperson'
        : 'SK Staff'
  );

  let roleBadgeColor = $derived(
    currentRole === 'admin'
      ? 'bg-purple-500/20 text-purple-200'
      : 'bg-blue-500/20 text-blue-200'
  );
</script>

<!-- ── Account Edit Modal ──────────────────────────────────────────────────── -->
{#if showAccountModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(10,31,68,0.55);">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

      <!-- Modal Header -->
      <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100" style="background: #0A1F44;">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base"
               style="background: rgba(255,255,255,0.15);">
            {(($user as any)?.full_name ?? 'A').charAt(0)}
          </div>
          <div>
            <div class="text-white font-semibold text-sm">{($user as any)?.full_name}</div>
            <div class="text-white/50 text-xs">@{($user as any)?.username}</div>
          </div>
        </div>
        <button onclick={() => showAccountModal = false}
          class="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition">
          <X size={18} />
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-slate-100">
        <button
          onclick={() => { activeTab = 'profile'; accountError = ''; accountSuccess = ''; }}
          class="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors
                 {activeTab === 'profile' ? 'border-[#0A1F44] text-[#0A1F44]' : 'border-transparent text-slate-400 hover:text-slate-600'}">
          <User size={14} /> Profile
        </button>
        <button
          onclick={() => { activeTab = 'password'; accountError = ''; accountSuccess = ''; }}
          class="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors
                 {activeTab === 'password' ? 'border-[#0A1F44] text-[#0A1F44]' : 'border-transparent text-slate-400 hover:text-slate-600'}">
          <Lock size={14} /> Change Password
        </button>
      </div>

      <div class="px-6 py-5">

        <!-- Alerts -->
        {#if accountError}
          <div class="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{accountError}</div>
        {/if}
        {#if accountSuccess}
          <div class="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">{accountSuccess}</div>
        {/if}

        {#if activeTab === 'profile'}
          <!-- Profile Tab -->
          <div class="space-y-4">
            <div>
              <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5" for="am_fn">
                Full Name *
              </label>
              <div class="relative">
                <User size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input id="am_fn" bind:value={accountForm.full_name}
                  class="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-slate-50"
                  placeholder="Your full name" />
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5" for="am_em">
                Email Address
              </label>
              <div class="relative">
                <Mail size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input id="am_em" type="email" bind:value={accountForm.email}
                  class="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-slate-50"
                  placeholder="your@email.com" />
              </div>
            </div>
            <!-- Read-only info -->
            <div class="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-400">Username</span>
                <span class="font-medium text-slate-600">@{($user as any)?.username}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-400">Position</span>
                <span class="font-medium text-slate-600">{positionLabel}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-400">Role</span>
                <span class="font-medium text-slate-600 capitalize">{currentRole}</span>
              </div>
            </div>
          </div>

          <div class="flex gap-2 mt-5">
            <button onclick={saveProfile} disabled={accountLoading}
              class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style="background: #0A1F44;">
              <Save size={14} /> {accountLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button onclick={() => showAccountModal = false}
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>

        {:else}
          <!-- Password Tab -->
          <div class="space-y-4">
            <div>
              <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5" for="am_cur">
                Current Password *
              </label>
              <div class="relative">
                <Lock size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input id="am_cur" type={showCurrent ? 'text' : 'password'} bind:value={passwordForm.current}
                  class="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-slate-50"
                  placeholder="Enter current password" />
                <button type="button" onclick={() => showCurrent = !showCurrent}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {#if showCurrent}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
                </button>
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5" for="am_new">
                New Password *
              </label>
              <div class="relative">
                <Lock size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input id="am_new" type={showNew ? 'text' : 'password'} bind:value={passwordForm.newPass}
                  class="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-slate-50"
                  placeholder="Min. 6 characters" />
                <button type="button" onclick={() => showNew = !showNew}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {#if showNew}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
                </button>
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5" for="am_conf">
                Confirm New Password *
              </label>
              <div class="relative">
                <Lock size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input id="am_conf" type={showConfirm ? 'text' : 'password'} bind:value={passwordForm.confirm}
                  class="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-slate-50"
                  placeholder="Repeat new password" />
                <button type="button" onclick={() => showConfirm = !showConfirm}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {#if showConfirm}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
                </button>
              </div>
            </div>
          </div>

          <div class="flex gap-2 mt-5">
            <button onclick={savePassword} disabled={accountLoading}
              class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style="background: #0A1F44;">
              <Lock size={14} /> {accountLoading ? 'Saving...' : 'Change Password'}
            </button>
            <button onclick={() => showAccountModal = false}
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if ($page.url.pathname as string) === '/login'
  || ($page.url.pathname as string) === '/forgot-password'
  || ($page.url.pathname as string) === '/reset-password'}
  {@render children()}
{:else if $user}
  <div class="flex h-screen overflow-hidden" style="background: #F5F7FA;">

    <!-- Sidebar -->
    <aside
      class="{collapsed ? 'w-17.5' : 'w-60'} flex flex-col shrink-0 transition-all duration-300 ease-in-out"
      style="background: #0A1F44;"
    >
      <!-- Logo -->
      <div class="flex items-center px-4 py-4 border-b border-white/10
                  {collapsed ? 'justify-center' : 'justify-between'}">
        {#if !collapsed}
          <div class="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="SK Logo" class="w-12 h-12 object-contain shrink-0 drop-shadow-md" />
            <span class="text-xs font-bold text-white leading-snug">
              SK Beneficiary<br/>Tracking and<br/>Management System
            </span>
          </div>
        {:else}
          <img src="/logo.png" alt="SK Logo" class="w-10 h-10 object-contain drop-shadow-md" />
        {/if}
        <button
          onclick={() => collapsed = !collapsed}
          class="p-1.5 rounded-lg transition text-white/40 hover:text-white hover:bg-white/10 shrink-0
                 {collapsed ? 'hidden' : ''}"
        >
          <ChevronLeft size={15} />
        </button>
      </div>

      {#if collapsed}
        <button onclick={() => collapsed = !collapsed}
          class="mx-auto mt-3 p-1.5 rounded-lg transition text-white/40 hover:text-white hover:bg-white/10">
          <ChevronRight size={15} />
        </button>
      {/if}

      {#if !collapsed}
        <div class="px-5 pt-5 pb-1">
          <span class="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Menu</span>
        </div>
      {/if}

      <!-- Nav -->
      <nav class="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {#each nav as item}
          {@const active = ($page.url.pathname as string) === item.href}
          <a
            href={item.href}
            title={collapsed ? item.label : ''}
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                   {collapsed ? 'justify-center' : ''}
                   {active ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}"
            style={active ? 'background: rgba(255,255,255,0.15);' : ''}
          >
            <item.icon size={18} class="shrink-0" />
            {#if !collapsed}<span>{item.label}</span>{/if}
          </a>
        {/each}
      </nav>

      <!-- User info -->
      <div class="px-3 pb-4 border-t border-white/10 pt-3 space-y-2">
        {#if !collapsed}
          <div class="px-2 pb-1">
            <span class="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Account</span>
          </div>
        {/if}

        <!-- Clickable account card -->
        {#if !collapsed}
          <button
            onclick={openAccountModal}
            class="w-full px-3 py-2 rounded-xl text-left transition group"
            style="background: rgba(255,255,255,0.08);"
            onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.13)'}
            onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
            title="Edit your account"
          >
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <div class="text-[10px] text-white/40">Logged in as</div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-30 text-right {roleBadgeColor}">
                  {positionLabel}
                </span>
                <Pencil size={10} class="text-white/30 group-hover:text-white/60 transition shrink-0" />
              </div>
            </div>
            <div class="text-xs font-semibold text-white truncate">{($user as any).full_name}</div>
            <div class="text-[10px] text-white/30">@{($user as any).username}</div>
          </button>
        {:else}
          <!-- Collapsed: just avatar button -->
          <button
            onclick={openAccountModal}
            class="flex justify-center w-full py-1 group"
            title="Edit account"
          >
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition group-hover:bg-white/25"
                 style="background:rgba(255,255,255,0.15);">
              {(($user as any).full_name ?? 'A').charAt(0)}
            </div>
          </button>
        {/if}

        <!-- Staff restriction notice -->
        {#if !collapsed && currentRole === 'staff'}
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] text-white/40"
               style="background:rgba(255,255,255,0.05);">
            <ShieldAlert size={12} class="shrink-0 text-white/30" />
            Settings restricted to Admin only
          </div>
        {/if}

        <button
          onclick={handleLogout}
          title={collapsed ? 'Sign out' : ''}
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition
                 text-white/60 hover:bg-red-500/20 hover:text-red-300
                 {collapsed ? 'justify-center' : ''}"
        >
          <LogOut size={16} class="shrink-0" />
          {#if !collapsed}<span>Sign out</span>{/if}
        </button>
      </div>
    </aside>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto" style="background: #F5F7FA;">
      {@render children()}
    </main>
  </div>
{:else}
  <!-- not logged in and not a public page — redirect handled by onMount -->
  {@render children()}
{/if}