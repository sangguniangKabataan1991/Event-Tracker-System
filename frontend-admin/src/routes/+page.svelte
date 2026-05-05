<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api.js';
  import ClipboardList from 'lucide-svelte/icons/clipboard-list';
  import CheckSquare from 'lucide-svelte/icons/check-square';
  import Clock from 'lucide-svelte/icons/clock';
  import Users from 'lucide-svelte/icons/users';
  import XCircle from 'lucide-svelte/icons/x-circle';
  import Trophy from 'lucide-svelte/icons/trophy';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import UserPlus from 'lucide-svelte/icons/user-plus';
  import ThumbsUp from 'lucide-svelte/icons/thumbs-up';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronUp from 'lucide-svelte/icons/chevron-up';

  interface AppRow {
    id: number;
    full_name: string;
    program_title: string;
    program_id: number;
    created_at: string;
    status: string;
  }
  interface Stats {
    totalPrograms: number;
    activePrograms: number;
    pendingApps: number;
    approvedBeneficiaries: number;
    rejectedApps: number;
  }
  interface MostAssisted {
    id: number;
    full_name: string;
    address: string;
    program_count: number;
  }
  interface ProgramStat {
    id: number;
    title: string;
    category: string;
    slots: number;
    slots_used: number;
    status: string;
    pending_count: number;
    approved_count: number;
  }
  interface RecentUser {
    id: number;
    full_name: string;
    username: string;
    created_at: string;
  }
  interface ProgramGroup {
    program_title: string;
    program_id: number;
    applicants: AppRow[];
    expanded: boolean;
  }

  let stats         = $state<Stats | null>(null);
  let recentPending = $state<AppRow[]>([]);
  let recentApproved= $state<AppRow[]>([]);
  let recentUsers   = $state<RecentUser[]>([]);
  let mostAssisted  = $state<MostAssisted[]>([]);
  let nearlyFull    = $state<ProgramStat[]>([]);
  let pendingGroups = $state<ProgramGroup[]>([]);
  let rejectedApps  = $state<AppRow[]>([]);
  let loading       = $state(true);
  let error         = $state('');

  let showPendingDropdown  = $state(false);
  let showRejectedDropdown = $state(false);

  onMount(async () => {
    try {
      const [rep, pending, approved, users, rejected, programs] = await Promise.all([
        apiFetch('/beneficiaries/reports/summary'),
        apiFetch('/applications?status=pending&sort=newest'),
        apiFetch('/applications?status=approved'),
        apiFetch('/users'),
        apiFetch('/applications?status=rejected'),
        apiFetch('/programs'),
      ]);

      stats        = rep.summary;
      mostAssisted = (rep.mostAssisted as MostAssisted[]).slice(0, 5);

      nearlyFull = (programs as ProgramStat[])
        .filter(p => p.slots > 0 && p.slots_used > 0 && p.status === 'open')
        .sort((a, b) => (b.slots_used / b.slots) - (a.slots_used / a.slots))
        .slice(0, 5);

      const sortedPending = (pending as AppRow[])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      recentPending = sortedPending.slice(0, 20);

      const groupMap = new Map<string, ProgramGroup>();
      for (const app of sortedPending) {
        if (!groupMap.has(app.program_title)) {
          groupMap.set(app.program_title, {
            program_title: app.program_title,
            program_id:    app.program_id,
            applicants:    [],
            expanded:      false,
          });
        }
        groupMap.get(app.program_title)!.applicants.push(app);
      }
      pendingGroups = Array.from(groupMap.values()).slice(0, 8);

      recentApproved = (approved as AppRow[]).slice(0, 5);
      rejectedApps   = (rejected  as AppRow[]).slice(0, 10);

      recentUsers = (users as RecentUser[])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

    } catch (e) {
      error = e instanceof Error ? e.message : 'Error loading dashboard';
    } finally {
      loading = false;
    }
  });

  function pct(used: number, total: number) {
    if (!total) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function toggleGroup(i: number) {
    pendingGroups[i].expanded = !pendingGroups[i].expanded;
  }

  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.dropdown-wrapper')) {
      showPendingDropdown  = false;
      showRejectedDropdown = false;
    }
  }
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="p-4 sm:p-6 space-y-5 sm:space-y-6">
  <div>
    <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
    <p class="text-gray-500 text-sm">SK Beneficiary Tracking and Management System</p>
  </div>

  {#if loading}
    <div class="flex items-center gap-2 text-gray-400 text-sm py-12">
      <div class="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin" style="border-top-color:#0A1F44;"></div>
      Loading dashboard...
    </div>
  {:else if error}
    <div class="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{error}</div>
  {:else if stats}

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

      <a href="/programs"
        class="card border border-[#0A1F44]/15 bg-[#0A1F44]/10 text-[#0A1F44] flex flex-col gap-1
               no-underline hover:opacity-80 hover:scale-[1.02] transition-all duration-150 cursor-pointer p-4">
        <ClipboardList size={22} />
        <div class="text-2xl sm:text-3xl font-bold mt-1">{stats.totalPrograms ?? 0}</div>
        <div class="text-xs font-medium">Total Programs</div>
      </a>

      <a href="/programs?status=open"
        class="card border border-emerald-100 bg-emerald-50 text-emerald-700 flex flex-col gap-1
               no-underline hover:opacity-80 hover:scale-[1.02] transition-all duration-150 cursor-pointer p-4">
        <CheckSquare size={22} />
        <div class="text-2xl sm:text-3xl font-bold mt-1">{stats.activePrograms ?? 0}</div>
        <div class="text-xs font-medium">Active Programs</div>
      </a>

      <!-- Pending dropdown -->
      <div class="relative dropdown-wrapper">
        <button
          onclick={(e) => { e.stopPropagation(); showPendingDropdown = !showPendingDropdown; showRejectedDropdown = false; }}
          class="card border border-amber-100 bg-amber-50 text-amber-700 flex flex-col gap-1 w-full text-left
                 hover:opacity-80 hover:scale-[1.02] transition-all duration-150 cursor-pointer p-4">
          <Clock size={22} />
          <div class="text-2xl sm:text-3xl font-bold mt-1">{stats.pendingApps ?? 0}</div>
          <div class="text-xs font-medium flex items-center justify-between">
            Pending
            {#if showPendingDropdown}<ChevronUp size={12} />{:else}<ChevronDown size={12} />{/if}
          </div>
        </button>
        {#if showPendingDropdown}
          <div class="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg w-72 max-h-64 overflow-y-auto">
            <div class="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600">Pending Applicants</span>
              <a href="/applications?status=pending" class="text-xs text-[#0A1F44] hover:underline font-medium">View all →</a>
            </div>
            {#if recentPending.length === 0}
              <p class="text-xs text-slate-400 px-3 py-4 text-center">No pending applications</p>
            {:else}
              {#each recentPending as app}
                <a href="/applications?program={app.program_id}&status=pending"
                  class="block px-3 py-2 border-b border-slate-50 hover:bg-amber-50 transition-colors no-underline">
                  <div class="text-xs font-medium text-slate-800">{app.full_name}</div>
                  <div class="text-xs text-slate-400 truncate">{app.program_title}</div>
                </a>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <a href="/beneficiaries"
        class="card border border-[#0A1F44]/15 bg-[#0A1F44]/10 text-[#0A1F44] flex flex-col gap-1
               no-underline hover:opacity-80 hover:scale-[1.02] transition-all duration-150 cursor-pointer p-4">
        <Users size={22} />
        <div class="text-2xl sm:text-3xl font-bold mt-1">{stats.approvedBeneficiaries ?? 0}</div>
        <div class="text-xs font-medium">Beneficiaries</div>
      </a>

      <!-- Rejected dropdown -->
      <div class="relative dropdown-wrapper col-span-2 md:col-span-1">
        <button
          onclick={(e) => { e.stopPropagation(); showRejectedDropdown = !showRejectedDropdown; showPendingDropdown = false; }}
          class="card border border-red-100 bg-red-50 text-red-700 flex flex-col gap-1 w-full text-left
                 hover:opacity-80 hover:scale-[1.02] transition-all duration-150 cursor-pointer p-4">
          <XCircle size={22} />
          <div class="text-2xl sm:text-3xl font-bold mt-1">{stats.rejectedApps ?? 0}</div>
          <div class="text-xs font-medium flex items-center justify-between">
            Rejected
            {#if showRejectedDropdown}<ChevronUp size={12} />{:else}<ChevronDown size={12} />{/if}
          </div>
        </button>
        {#if showRejectedDropdown}
          <div class="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg w-72 max-h-64 overflow-y-auto">
            <div class="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600">Rejected Applicants</span>
              <a href="/applications?status=rejected" class="text-xs text-[#0A1F44] hover:underline font-medium">View all →</a>
            </div>
            {#if rejectedApps.length === 0}
              <p class="text-xs text-slate-400 px-3 py-4 text-center">No rejected applications</p>
            {:else}
              {#each rejectedApps as app}
                <a href="/applications?program={app.program_id}&status=rejected"
                  class="block px-3 py-2 border-b border-slate-50 hover:bg-red-50 transition-colors no-underline">
                  <div class="text-xs font-medium text-slate-800">{app.full_name}</div>
                  <div class="text-xs text-slate-400 truncate">{app.program_title}</div>
                </a>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

      <!-- Recent Pending grouped per program -->
      <div class="card lg:col-span-2">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
            <Clock size={16} class="text-amber-500 shrink-0" /> Recent Pending Applications
          </h2>
          <a href="/applications?status=pending" class="text-xs font-medium hover:underline shrink-0" style="color:#0A1F44;">
            View all →
          </a>
        </div>
        {#if pendingGroups.length === 0}
          <p class="text-gray-400 text-sm py-6 text-center">No pending applications</p>
        {:else}
          <div class="space-y-2">
            {#each pendingGroups as group, i}
              <div class="border border-slate-100 rounded-xl overflow-hidden">
                <div class="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-amber-50 transition-colors">
                  <a href="/applications?program={group.program_id}&status=pending"
                    class="flex items-center gap-2 min-w-0 flex-1 no-underline group">
                    <span class="text-xs font-semibold text-slate-700 truncate group-hover:text-amber-700 transition-colors">
                      {group.program_title}
                    </span>
                    <span class="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {group.applicants.length}
                    </span>
                  </a>
                  <button type="button" onclick={() => toggleGroup(i)}
                    class="p-1 ml-2 shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
                    {#if group.expanded}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
                  </button>
                </div>
                {#if group.expanded}
                  <div class="divide-y divide-slate-50">
                    {#each group.applicants as app}
                      <div class="flex items-center justify-between px-4 py-2 gap-2">
                        <span class="text-sm text-slate-700 truncate">{app.full_name}</span>
                        <span class="text-xs text-slate-400 whitespace-nowrap shrink-0">{fmtDate(app.created_at)}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Top Recipients -->
      <div class="card">
        <h2 class="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm sm:text-base">
          <Trophy size={16} class="text-yellow-500 shrink-0" /> Top Recipients
        </h2>
        {#if mostAssisted.length === 0}
          <p class="text-gray-400 text-sm">No data available</p>
        {:else}
          <div class="space-y-1">
            {#each mostAssisted as r, i}
              <a href="/beneficiaries?tab=search&q={encodeURIComponent(r.full_name)}"
                class="flex items-center gap-2.5 no-underline rounded-md -mx-1 px-1 py-1.5
                       hover:bg-gray-50 transition-colors cursor-pointer">
                <span class="text-xs font-bold w-5 text-center rounded-full py-0.5 shrink-0"
                  style="background:{i===0?'#0A1F44':i===1?'#374151':'#9CA3AF'}; color:white;">
                  {i + 1}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate text-gray-800">{r.full_name}</div>
                  <div class="text-xs text-gray-400 truncate">{r.address}</div>
                </div>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                  style="background:#0A1F44;">{r.program_count}x</span>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Second Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

      <!-- Programs Slot Status -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
            <AlertTriangle size={16} class="text-orange-500 shrink-0" /> Programs Slot Status
          </h2>
          <a href="/programs" class="text-xs font-medium hover:underline shrink-0" style="color:#0A1F44;">
            View all →
          </a>
        </div>
        {#if nearlyFull.length === 0}
          <p class="text-gray-400 text-sm py-4 text-center">No active programs with beneficiaries yet</p>
        {:else}
          <div class="space-y-3">
            {#each nearlyFull as p}
              {@const pctVal = pct(p.slots_used, p.slots)}
              <a href="/applications?program={p.id}"
                class="block no-underline rounded-xl border border-slate-100 p-3
                       hover:bg-orange-50 hover:border-orange-200 transition-all cursor-pointer group">
                <div class="flex justify-between items-start mb-2 gap-2">
                  <span class="text-xs font-semibold text-slate-700 leading-tight
                               group-hover:text-orange-700 transition-colors flex-1">
                    {p.title}
                  </span>
                  {#if pctVal >= 100}
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">Full</span>
                  {:else if pctVal >= 75}
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">Nearly Full</span>
                  {:else}
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 shrink-0">Filling</span>
                  {/if}
                </div>
                <div class="h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                  <div class="h-full rounded-full transition-all"
                    style="width:{pctVal}%; background:{pctVal>=100?'#dc2626':pctVal>=75?'#f59e0b':'#0A1F44'};"></div>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-slate-400">{p.slots_used} / {p.slots} slots</span>
                  <span class="font-semibold"
                    style="color:{pctVal>=100?'#dc2626':pctVal>=75?'#d97706':'#0A1F44'}">{pctVal}%</span>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Newly Registered -->
      <div class="card">
        <h2 class="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm sm:text-base">
          <UserPlus size={16} style="color:#0A1F44;" class="shrink-0" /> Newly Registered
        </h2>
        {#if recentUsers.length === 0}
          <p class="text-gray-400 text-sm">No new users</p>
        {:else}
          <div class="space-y-2.5">
            {#each recentUsers as u}
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style="background:#0A1F44;">
                  {u.full_name.charAt(0)}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{u.full_name}</div>
                  <div class="text-xs text-gray-400">@{u.username}</div>
                </div>
                <div class="text-xs text-gray-400 shrink-0">{fmtDate(u.created_at)}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Recently Approved -->
      <div class="card">
        <h2 class="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm sm:text-base">
          <ThumbsUp size={16} class="text-emerald-600 shrink-0" /> Recently Approved
        </h2>
        {#if recentApproved.length === 0}
          <p class="text-gray-400 text-sm">No recent approvals</p>
        {:else}
          <div class="space-y-2.5">
            {#each recentApproved as app}
              <div class="flex items-center gap-2.5">
                <div class="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5"></div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{app.full_name}</div>
                  <div class="text-xs text-gray-400 truncate">{app.program_title}</div>
                </div>
                <div class="text-xs text-gray-400 shrink-0 whitespace-nowrap">{fmtDate(app.created_at)}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    </div>
  {/if}
</div>