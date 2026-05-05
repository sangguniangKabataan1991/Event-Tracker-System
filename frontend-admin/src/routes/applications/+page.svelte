<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { apiFetch } from '$lib/api.js';
  import * as XLSX from 'xlsx';
  import Search from 'lucide-svelte/icons/search';
  import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';
  import CheckCircle from 'lucide-svelte/icons/check-circle';
  import Clock from 'lucide-svelte/icons/clock';
  import CircleDashed from 'lucide-svelte/icons/circle-dashed';
  import ListFilter from 'lucide-svelte/icons/list-filter';
  import ThumbsUp from 'lucide-svelte/icons/thumbs-up';
  import Ban from 'lucide-svelte/icons/ban';
  import Download from 'lucide-svelte/icons/download';
  import CalendarDays from 'lucide-svelte/icons/calendar-days';
  import Square from 'lucide-svelte/icons/square';
  import CheckSquare from 'lucide-svelte/icons/check-square';

  type StatusKey = 'pending' | 'approved' | 'rejected' | 'waitlist';

  interface Program { id: string | number; title: string; status: string; }
  interface Application {
    id: string | number;
    full_name: string;
    address: string;
    age: number;
    contact: string;
    status: StatusKey;
    program_title?: string;
    created_at?: string;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let programs          = $state<Program[]>([]);
  let applications      = $state<Application[]>([]);
  let selectedProgramId = $state('');
  let filterStatus      = $state('');
  let searchTerm        = $state('');
  let dateFrom          = $state('');
  let dateTo            = $state('');
  let loading           = $state(false);
  let error             = $state('');
  let success           = $state('');

  // Bulk selection
  let selected  = $state<Set<string | number>>(new Set());
  let selectAll = $state(false);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(async () => {
    programs = await apiFetch('/programs');

    // Read both ?program= and ?status= from the URL so that dashboard card
    // links like /applications?status=pending land with the correct filter active
    const pid    = page.url.searchParams.get('program');
    const status = page.url.searchParams.get('status');

    if (pid)    selectedProgramId = pid;
    if (status) filterStatus      = status;   // ← NEW: pre-select status from URL

    await loadApplications();
  });

  // ── Data loading ───────────────────────────────────────────────────────────
  async function loadApplications() {
    loading   = true;
    selected  = new Set();
    selectAll = false;
    try {
      let url: string;
      if (selectedProgramId) {
        url = `/applications/program/${selectedProgramId}?`;
        if (filterStatus) url += `status=${filterStatus}&`;
        if (searchTerm)   url += `search=${encodeURIComponent(searchTerm)}&`;
        if (dateFrom)     url += `from=${dateFrom}&`;
        if (dateTo)       url += `to=${dateTo}&`;
      } else {
        url = `/applications?`;
        if (filterStatus) url += `status=${filterStatus}&`;
        if (searchTerm)   url += `search=${encodeURIComponent(searchTerm)}&`;
        if (dateFrom)     url += `from=${dateFrom}&`;
        if (dateTo)       url += `to=${dateTo}&`;
      }
      applications = await apiFetch(url);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load applications';
    } finally {
      loading = false;
    }
  }

  // ── Status update ──────────────────────────────────────────────────────────
  async function updateStatus(id: string | number, status: string) {
    const notes = status === 'rejected'
      ? prompt('Reason for rejection (optional):')
      : null;
    try {
      await apiFetch(`/applications/${id}/status`, { method: 'PATCH', body: { status, notes } });
      success = `Application marked as ${status}.`;
      await loadApplications();
      setTimeout(() => success = '', 3000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update status';
    }
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────
  function toggleSelect(id: string | number) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    selected  = next;
    selectAll = next.size === applications.length;
  }

  function toggleSelectAll() {
    if (selectAll) {
      selected  = new Set();
      selectAll = false;
    } else {
      selected  = new Set(applications.map(a => a.id));
      selectAll = true;
    }
  }

  async function bulkAction(status: string) {
    const targets = applications.filter(a => selected.has(a.id) && (a.status === 'pending' || a.status === 'waitlist'));
    if (targets.length === 0) {
      error = 'No pending/waitlist applications selected.';
      setTimeout(() => error = '', 3000);
      return;
    }
    if (!confirm(`${status === 'approved' ? 'Approve' : 'Reject'} ${targets.length} application(s)?`)) return;
    for (const app of targets) {
      await updateStatus(app.id, status);
    }
    selected  = new Set();
    selectAll = false;
  }

  // ── Export to Excel ────────────────────────────────────────────────────────
  function exportToExcel() {
    const rows = applications.map(a => ({
      'Name':         a.full_name,
      'Program':      a.program_title ?? '',
      'Address':      a.address,
      'Age':          a.age,
      'Contact':      a.contact,
      'Status':       a.status,
      'Date Applied': a.created_at ? new Date(a.created_at).toLocaleDateString('en-PH') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Applications');
    XLSX.writeFile(wb, `applications_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const statusClass: Record<StatusKey, string> = {
    pending:  'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    waitlist: 'badge-waitlist',
  };

  let pendingSelected = $derived(
    applications.filter(a => selected.has(a.id) && (a.status === 'pending' || a.status === 'waitlist')).length
  );
</script>

<div class="p-6 space-y-5">

  <!-- Page Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Applications</h1>
      <p class="text-gray-500 text-sm">Review and manage applicant submissions</p>
    </div>
    {#if applications.length > 0}
      <button onclick={exportToExcel}
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition">
        <Download size={15} /> Export Excel
      </button>
    {/if}
  </div>

  <!-- Alert Messages -->
  {#if error}
    <div class="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
  {/if}
  {#if success}
    <div class="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{success}</div>
  {/if}

  <!-- ── FILTER BAR ─────────────────────────────────────────────────────── -->
  <div class="card space-y-3">
    <div class="flex flex-wrap gap-3 items-end">

      <!-- Program Selector -->
      <div class="flex-1 min-w-48">
        <label class="label flex items-center gap-1.5" for="prog">
          <SlidersHorizontal size={13} class="text-gray-400" /> Program
        </label>
        <select id="prog" bind:value={selectedProgramId} onchange={loadApplications} class="input">
          <option value="">— All Programs —</option>
          {#each programs as p}
            <option value={p.id}>{p.title} ({p.status})</option>
          {/each}
        </select>
      </div>

      <!-- Status Filter -->
      <div class="w-44">
        <label class="label flex items-center gap-1.5" for="status">
          <ListFilter size={13} class="text-gray-400" /> Status
        </label>
        <select id="status" bind:value={filterStatus} onchange={loadApplications} class="input">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="waitlist">Waitlist</option>
        </select>
      </div>

      <!-- Name Search -->
      <div class="flex-1 min-w-48">
        <label class="label flex items-center gap-1.5" for="search">
          <Search size={13} class="text-gray-400" /> Search
        </label>
        <div class="relative">
          <Search size={15} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input id="search" bind:value={searchTerm} oninput={loadApplications}
            class="input pl-8" placeholder="Search by name..." />
        </div>
      </div>
    </div>

    <!-- Date Range Row -->
    <div class="flex flex-wrap gap-3 items-end">
      <div class="w-48">
        <label class="label flex items-center gap-1.5" for="date-from">
          <CalendarDays size={13} class="text-gray-400" /> From
        </label>
        <input id="date-from" type="date" bind:value={dateFrom} onchange={loadApplications} class="input" />
      </div>
      <div class="w-48">
        <label class="label flex items-center gap-1.5" for="date-to">
          <CalendarDays size={13} class="text-gray-400" /> To
        </label>
        <input id="date-to" type="date" bind:value={dateTo} onchange={loadApplications} class="input" />
      </div>
      {#if dateFrom || dateTo}
        <button onclick={() => { dateFrom = ''; dateTo = ''; loadApplications(); }}
          class="text-xs text-gray-400 hover:text-red-500 transition self-end pb-2.5">
          Clear dates
        </button>
      {/if}

      <!-- Active status filter pill -->
      {#if filterStatus}
        <div class="self-end pb-2">
          <span class="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border
            {filterStatus === 'pending'  ? 'bg-amber-100 text-amber-700 border-amber-200'  : ''}
            {filterStatus === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : ''}
            {filterStatus === 'rejected' ? 'bg-red-100 text-red-700 border-red-200'        : ''}
            {filterStatus === 'waitlist' ? 'bg-blue-100 text-blue-700 border-blue-200'     : ''}
          ">
            Showing: {filterStatus}
            <button onclick={() => { filterStatus = ''; loadApplications(); }}
              class="ml-1 hover:opacity-60 transition" title="Clear status filter">×</button>
          </span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Loading -->
  {#if loading}
    <div class="text-gray-400 text-sm">Loading applications...</div>

  <!-- Empty State -->
  {:else if applications.length === 0}
    <div class="card text-center text-gray-400 py-16">
      <CircleDashed size={36} class="mx-auto mb-3 text-gray-300" />
      <p class="text-sm">No applications found</p>
      {#if filterStatus}
        <button onclick={() => { filterStatus = ''; loadApplications(); }}
          class="text-xs text-blue-500 hover:underline mt-2">Clear status filter</button>
      {/if}
    </div>

  {:else}
    <!-- Applications Table -->
    <div class="card overflow-x-auto p-0">

      <!-- Toolbar -->
      <div class="flex items-center gap-3 px-4 py-3 flex-wrap border-b border-gray-100">
        <span class="font-medium text-gray-800 text-sm">{applications.length} application(s)</span>

        {#if selected.size > 0}
          <span class="text-xs text-gray-400">{selected.size} selected ({pendingSelected} actionable)</span>
          <button onclick={() => bulkAction('approved')}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition">
            <CheckCircle size={13} /> Approve Selected
          </button>
          <button onclick={() => bulkAction('rejected')}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition">
            <Ban size={13} /> Reject Selected
          </button>
        {:else}
          {#if applications.filter(a => a.status === 'pending').length > 0}
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition"
              onclick={async () => {
                if (!confirm(`Approve all ${applications.filter(a => a.status === 'pending').length} pending applications?`)) return;
                for (const app of applications.filter(a => a.status === 'pending')) {
                  await updateStatus(app.id, 'approved');
                }
              }}
            >
              <CheckCircle size={13} /> Approve All Pending
            </button>
          {/if}
        {/if}
      </div>

      <!-- Data Table -->
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr class="text-left text-gray-500">
            <th class="px-4 py-3 w-10">
              <button onclick={toggleSelectAll} class="text-gray-400 hover:text-gray-600">
                {#if selectAll}
                  <CheckSquare size={16} class="text-blue-600" />
                {:else}
                  <Square size={16} />
                {/if}
              </button>
            </th>
            <th class="px-4 py-3 font-medium">Name</th>
            {#if !selectedProgramId}
              <th class="px-4 py-3 font-medium">Program</th>
            {/if}
            <th class="px-4 py-3 font-medium">Address</th>
            <th class="px-4 py-3 font-medium">Age</th>
            <th class="px-4 py-3 font-medium">Contact</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          {#each applications as app}
            <tr class="hover:bg-gray-50 {selected.has(app.id) ? 'bg-blue-50/40' : ''}">
              <td class="px-4 py-3">
                <button onclick={() => toggleSelect(app.id)} class="text-gray-400 hover:text-gray-600">
                  {#if selected.has(app.id)}
                    <CheckSquare size={16} class="text-blue-600" />
                  {:else}
                    <Square size={16} />
                  {/if}
                </button>
              </td>
              <td class="px-4 py-3 font-medium">{app.full_name}</td>
              {#if !selectedProgramId}
                <td class="px-4 py-3 text-gray-500 text-xs max-w-45 truncate">{app.program_title ?? '—'}</td>
              {/if}
              <td class="px-4 py-3 text-gray-600">{app.address}</td>
              <td class="px-4 py-3">{app.age}</td>
              <td class="px-4 py-3 text-gray-600">{app.contact}</td>
              <td class="px-4 py-3">
                <span class={statusClass[app.status] ?? 'badge-pending'}>{app.status}</span>
              </td>
              <td class="px-4 py-3">
                {#if app.status === 'pending' || app.status === 'waitlist'}
                  <div class="flex gap-1.5">
                    <button class="btn-success flex items-center gap-1" onclick={() => updateStatus(app.id, 'approved')}>
                      <ThumbsUp size={12} /> Approve
                    </button>
                    <button class="btn-warning flex items-center gap-1" onclick={() => updateStatus(app.id, 'waitlist')}>
                      <Clock size={12} /> Waitlist
                    </button>
                    <button class="btn-danger flex items-center gap-1" onclick={() => updateStatus(app.id, 'rejected')}>
                      <Ban size={12} /> Reject
                    </button>
                  </div>
                {:else}
                  <span class="text-gray-400 text-xs flex items-center gap-1">
                    <CheckCircle size={11} /> Processed
                  </span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

</div>