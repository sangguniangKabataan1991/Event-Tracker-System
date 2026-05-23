<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { user, logout, apiFetch, API, token } from '$lib/api.js';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { LogOut, LayoutList, Camera, X, User, ChevronDown } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';

  let { children } = $props();

  const FULL_SCREEN_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

  let isFullScreen = $derived(
    FULL_SCREEN_ROUTES.some(
      (r) => $page.url.pathname === r || $page.url.pathname.startsWith(r + '?')
    )
  );

  // ── Profile dropdown state ─────────────────────────────────────────────────
  let showProfileMenu = $state(false);
  let profileMenuRef  = $state<HTMLDivElement | undefined>(undefined);

  // ── Avatar upload state ────────────────────────────────────────────────────
  let uploadingAvatar = $state(false);
  let avatarError     = $state('');
  let fileInputRef    = $state<HTMLInputElement | undefined>(undefined);

  // ── Close dropdown on outside click ───────────────────────────────────────
  function handleClickOutside(e: MouseEvent) {
    if (profileMenuRef && !profileMenuRef.contains(e.target as Node)) {
      showProfileMenu = false;
    }
  }

  onMount(() => {
    if (browser) document.addEventListener('mousedown', handleClickOutside);
  });

  onDestroy(() => {
    if (browser) document.removeEventListener('mousedown', handleClickOutside);
  });

  function handleLogout() {
    logout();
    goto('/login');
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

      // Update the user store with new avatar_url
      user.update((u: any) => u ? { ...u, avatar_url: data.avatar_url } : u);
    } catch (err) {
      avatarError = err instanceof Error ? err.message : 'Upload failed';
      setTimeout(() => avatarError = '', 4000);
    } finally {
      uploadingAvatar = false;
      if (fileInputRef) fileInputRef.value = '';
    }
  }

  // ── Avatar display helper ──────────────────────────────────────────────────
  function getInitial(name: string) {
    return (name || 'U').charAt(0).toUpperCase();
  }
</script>

{#if isFullScreen}
  {@render children()}
{:else}
  <div class="min-h-screen bg-slate-50">
    <!-- Navbar -->
    <nav
      class="w-full text-white shadow-lg"
      style="background:#0A1F44; border-bottom:1px solid rgba(255,255,255,0.08);"
    >
      <div class="flex w-full items-center px-4 py-3">

        <!-- Left: Logo -->
        <a href="/" class="flex items-center gap-2.5">
          <img src="/logo.png" alt="Logo" class="h-10 w-10 object-contain" />
          <div>
            <div class="text-sm font-bold tracking-wide">SK Portal</div>
            <div class="text-xs hidden sm:block" style="color:rgba(255,255,255,0.45);">
              Beneficiary Tracking and Management System
            </div>
          </div>
        </a>

        <!-- Right -->
        <div class="flex items-center gap-2 sm:gap-3 ml-auto">
          {#if $user}

            <!-- My Applications link -->
            <a
              href="/my-applications"
              class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition"
              style="color:rgba(255,255,255,0.65);"
              onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'}
              onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <LayoutList class="h-4 w-4" />
              <span class="hidden sm:inline">My Applications</span>
            </a>

            <!-- Profile avatar + dropdown -->
            <div class="relative" bind:this={profileMenuRef}>
              <button
                onclick={() => showProfileMenu = !showProfileMenu}
                class="flex items-center gap-2 rounded-xl px-2 py-1.5 transition"
                style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);"
                onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)'}
                onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
              >
                <!-- Avatar -->
                <div class="relative w-7 h-7 rounded-full overflow-hidden shrink-0">
                  {#if ($user as any)?.avatar_url}
                    <img
                      src={($user as any).avatar_url}
                      alt="Profile"
                      class="w-full h-full object-cover"
                    />
                  {:else}
                    <div
                      class="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                      style="background:rgba(255,255,255,0.2);"
                    >
                      {getInitial(($user as any)?.full_name)}
                    </div>
                  {/if}
                </div>

                <span class="hidden sm:block text-sm text-white max-w-28 truncate">
                  {($user as any)?.full_name}
                </span>
                <ChevronDown
                  class="h-3.5 w-3.5 transition-transform {showProfileMenu ? 'rotate-180' : ''}"
                  style="color:rgba(255,255,255,0.5);"
                />
              </button>

              <!-- Dropdown menu -->
              {#if showProfileMenu}
                <div
                  class="absolute right-0 top-full mt-2 z-50 w-60 rounded-2xl overflow-hidden shadow-2xl border"
                  style="background:#0A1F44; border-color:rgba(255,255,255,0.12);"
                >
                  <!-- User info header -->
                  <div class="px-4 py-4" style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <!-- Avatar with upload button -->
                    <div class="flex items-center gap-3 mb-3">
                      <div class="relative group shrink-0">
                        <div class="w-12 h-12 rounded-full overflow-hidden">
                          {#if ($user as any)?.avatar_url}
                            <img
                              src={($user as any).avatar_url}
                              alt="Profile"
                              class="w-full h-full object-cover"
                            />
                          {:else}
                            <div
                              class="w-full h-full flex items-center justify-center text-lg font-bold text-white"
                              style="background:rgba(255,255,255,0.15);"
                            >
                              {getInitial(($user as any)?.full_name)}
                            </div>
                          {/if}
                        </div>

                        <!-- Camera overlay -->
                        <button
                          onclick={() => fileInputRef?.click()}
                          disabled={uploadingAvatar}
                          class="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          style="background:rgba(0,0,0,0.55);"
                          title="Change photo"
                        >
                          {#if uploadingAvatar}
                            <div
                              class="w-4 h-4 border-2 border-white/30 rounded-full"
                              style="border-top-color:white; animation:spin 0.8s linear infinite;"
                            ></div>
                          {:else}
                            <Camera class="h-4 w-4 text-white" />
                          {/if}
                        </button>
                      </div>

                      <div class="min-w-0">
                        <div class="text-sm font-semibold text-white truncate">
                          {($user as any)?.full_name}
                        </div>
                        <div class="text-xs truncate" style="color:rgba(255,255,255,0.45);">
                          @{($user as any)?.username}
                        </div>
                        <button
                          onclick={() => fileInputRef?.click()}
                          disabled={uploadingAvatar}
                          class="text-xs mt-0.5 transition"
                          style="color:rgba(255,255,255,0.4);"
                          onmouseenter={(e) => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'}
                          onmouseleave={(e) => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'}
                        >
                          {uploadingAvatar ? 'Uploading...' : 'Change photo'}
                        </button>
                      </div>
                    </div>

                    {#if avatarError}
                      <div
                        class="text-xs rounded-lg px-3 py-2 mt-1"
                        style="background:rgba(220,38,38,0.2); color:#fca5a5;"
                      >
                        {avatarError}
                      </div>
                    {/if}
                  </div>

                  <!-- Hidden file input -->
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    bind:this={fileInputRef}
                    onchange={handleAvatarChange}
                  />

                  <!-- Menu items -->
                  <div class="py-1.5">
                    <a
                      href="/my-applications"
                      onclick={() => showProfileMenu = false}
                      class="flex items-center gap-2.5 px-4 py-2.5 text-sm transition"
                      style="color:rgba(255,255,255,0.7);"
                      onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                      onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <LayoutList class="h-4 w-4 shrink-0" />
                      My Applications
                    </a>

                    <div style="border-top:1px solid rgba(255,255,255,0.06); margin:4px 0;"></div>

                    <button
                      onclick={handleLogout}
                      class="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition"
                      style="color:rgba(255,255,255,0.5);"
                      onmouseenter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.15)';
                        (e.currentTarget as HTMLElement).style.color = '#fca5a5';
                      }}
                      onmouseleave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                      }}
                    >
                      <LogOut class="h-4 w-4 shrink-0" />
                      Sign Out
                    </button>
                  </div>
                </div>
              {/if}
            </div>

          {:else}
            <a href="/login" class="px-3 py-1.5 text-sm" style="color:rgba(255,255,255,0.65);">
              Login
            </a>
            <a
              href="/register"
              class="rounded-lg px-4 py-1.5 text-sm font-medium text-white"
              style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25);"
            >
              Register
            </a>
          {/if}
        </div>
      </div>
    </nav>

    <!-- Page Content -->
    <main class="mx-auto max-w-5xl px-4 py-6">
      {@render children()}
    </main>
  </div>
{/if}

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>