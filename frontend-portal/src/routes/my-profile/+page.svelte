<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { apiFetch, user } from '$lib/api.js';
  import {
    User as UserIcon, Phone, MapPin, Mail,
    Calendar, Hash, ArrowLeft, AlertCircle,
    Building, Home
        } from 'lucide-svelte';

  interface Profile {
    id: number;
    username: string;
    full_name: string;
    email?: string;
    contact?: string;
    address?: string;
    barangay?: string;
    birthday?: string;
    role: string;
    avatar_url?: string;
    created_at: string;
  }

  let profile = $state<Profile | null>(null);
  let loading = $state(true);
  let error   = $state('');

  onMount(async () => {
    if (!$user) { goto('/login'); return; }
    try {
      profile = await apiFetch('/auth/me');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load profile';
    } finally {
      loading = false;
    }
  });

  function formatDate(dateStr?: string) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function getInitial(name: string) {
    return (name || 'U').charAt(0).toUpperCase();
  }

  function computeAge(birthday?: string) {
    if (!birthday) return null;
    const today = new Date();
    const birth = new Date(birthday);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
</script>

<div class="max-w-4xl mx-auto space-y-4">

  <!-- Banner -->
  <div class="relative rounded-2xl overflow-hidden px-6 py-5"
       style="background: linear-gradient(135deg, #0A1F44 0%, #1e3a6e 100%);">
    <div class="absolute right-0 top-0 w-40 h-40 rounded-full opacity-5"
         style="background:white; transform:translate(30%,-30%);"></div>
    <div class="absolute right-10 bottom-0 w-24 h-24 rounded-full opacity-5"
         style="background:white; transform:translateY(40%);"></div>
    <div class="relative flex items-start justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">My Profile</h1>
        <p class="text-xs mt-0.5" style="color:rgba(255,255,255,0.5);">
          View all your profile details here.
        </p>
      </div>
      <a href="/"
         class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition"
         style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.8);"
         onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
         onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
      >
        <ArrowLeft class="h-3.5 w-3.5" /> Back
      </a>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-200"
           style="border-top-color:#0A1F44;"></div>
      Loading...
    </div>

  {:else if error}
    <div class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle class="h-4 w-4 shrink-0" />
      {error}
    </div>

  {:else if profile}

    <div style="display:grid; grid-template-columns:240px 1fr; gap:1rem; align-items:start;">

      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        <div class="h-16 w-full" style="background:#0A1F44;"></div>

        <div class="px-5 py-5 flex flex-col items-center text-center gap-1">
          <div class="w-14 h-14 rounded-full overflow-hidden shrink-0 mb-2"
               style="border:3px solid white;">
            {#if profile.avatar_url}
              <img src={profile.avatar_url} alt="Avatar" class="w-full h-full object-cover" />
            {:else}
              <div class="w-full h-full flex items-center justify-center text-xl font-bold text-white"
                   style="background:#0A1F44;">
                {getInitial(profile.full_name)}
              </div>
            {/if}
          </div>

          <h2 class="text-base font-bold text-slate-900">{profile.full_name}</h2>
          <p class="text-xs text-slate-400 mt-0.5">@{profile.username}</p>

          <span class="mt-3 mb-1 rounded-full px-3 py-1 text-xs font-medium capitalize
            {profile.role === 'admin' ? 'bg-purple-100 text-purple-700' :
             profile.role === 'staff' ? 'bg-blue-100 text-blue-700' :
             'bg-emerald-100 text-emerald-700'}">
            {profile.role}
          </span>

          <div class="w-full mt-4 mb-3" style="border-top:1px solid #f1f5f9;"></div>

          <div class="w-full text-left space-y-3 pb-2">
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <Mail class="h-3.5 w-3.5 shrink-0" style="color:#0A1F44;" />
              <span class="truncate">{profile.email || 'No email'}</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <Phone class="h-3.5 w-3.5 shrink-0" style="color:#0A1F44;" />
              <span>{profile.contact || '—'}</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-500">
            <Building class="h-3.5 w-3.5 shrink-0" style="color:#0A1F44;" />
            <span class="truncate">{profile.barangay || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Single card with both sections -->
      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-5 space-y-4">

        <!-- Personal Information -->
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Personal Information
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {#each [
              { icon: UserIcon, label: 'Full Name',      value: profile.full_name },
              { icon: Calendar, label: 'Birthday',       value: profile.birthday
                  ? `${formatDate(profile.birthday)}${computeAge(profile.birthday) !== null ? ` (${computeAge(profile.birthday)} yrs old)` : ''}`
                  : '—' },
              { icon: Phone,    label: 'Contact Number', value: profile.contact || '—' },
              { icon: Building, label: 'Barangay',     value: profile.barangay || '—' },
              { icon: Home,     label: 'Full Address', value: profile.address  || '—' },
            ] as row}
              {@const Icon = row.icon}
              <div class="flex items-start gap-3 py-3 border-b border-slate-100">
                <div class="mt-0.5 rounded-lg p-1.5 shrink-0" style="background:rgba(10,31,68,0.06);">
                  <Icon class="h-3.5 w-3.5" style="color:#0A1F44;" />
                </div>
                <div>
                  <p class="text-xs text-slate-400">{row.label}</p>
                  <p class="text-sm font-medium text-slate-800 mt-0.5">{row.value}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div style="border-top:1px solid #f1f5f9;"></div>

        <!-- Account Information -->
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Account Information
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {#each [
              { icon: Hash,     label: 'Username',      value: `@${profile.username}` },
              { icon: Mail,     label: 'Email Address', value: profile.email || '—' },
              { icon: Calendar, label: 'Member Since',  value: formatDate(profile.created_at) },
            ] as row}
              {@const Icon = row.icon}
              <div class="flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0">
                <div class="mt-0.5 rounded-lg p-1.5 shrink-0" style="background:rgba(10,31,68,0.06);">
                  <Icon class="h-3.5 w-3.5" style="color:#0A1F44;" />
                </div>
                <div>
                  <p class="text-xs text-slate-400">{row.label}</p>
                  <p class="text-sm font-medium text-slate-800 mt-0.5">{row.value}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>

      </div>
    </div>

  {/if}
</div>