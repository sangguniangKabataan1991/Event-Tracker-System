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
  import FileText from 'lucide-svelte/icons/file-text';
  import X from 'lucide-svelte/icons/x';
  import FileImage from 'lucide-svelte/icons/file-image';
  import FileScan from 'lucide-svelte/icons/file-scan';
  import Eye from 'lucide-svelte/icons/eye';
  import ExternalLink from 'lucide-svelte/icons/external-link';

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

  // ── Requirements types ──────────────────────────────────────────────────────
  interface RequirementFile {
    id: string | number;
    file_name: string;
    file_url: string;         // URL to the stored file
    file_type: string;        // e.g. "image/jpeg", "application/pdf"
    requirement_label?: string; // e.g. "Barangay Clearance", "Birth Certificate"
    uploaded_at?: string;
  }

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

  let selected  = $state<Set<string | number>>(new Set());
  let selectAll = $state(false);

  // ── Requirements modal state ────────────────────────────────────────────────
  let showReqModal     = $state(false);
  let reqModalApp      = $state<Application | null>(null);
  let reqFiles         = $state<RequirementFile[]>([]);
  let reqLoading       = $state(false);
  let reqError         = $state('');
  let lightboxUrl      = $state('');
  let lightboxOpen     = $state(false);
  let reqDialogEl      = $state<HTMLDialogElement | undefined>(undefined);

  onMount(async () => {
    programs = await apiFetch('/programs');
    const pid    = page.url.searchParams.get('program');
    const status = page.url.searchParams.get('status');
    if (pid)    selectedProgramId = pid;
    if (status) filterStatus      = status;
    await loadApplications();
  });

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

  async function updateStatus(id: string | number, status: string) {
    const notes = status === 'rejected' ? prompt('Reason for rejection (optional):') : null;
    try {
      await apiFetch(`/applications/${id}/status`, { method: 'PATCH', body: { status, notes } });
      success = `Application marked as ${status}.`;
      await loadApplications();
      setTimeout(() => success = '', 3000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update status';
    }
  }

  function toggleSelect(id: string | number) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    selected  = next;
    selectAll = next.size === applications.length;
  }

  function toggleSelectAll() {
    if (selectAll) { selected = new Set(); selectAll = false; }
    else { selected = new Set(applications.map(a => a.id)); selectAll = true; }
  }

  async function bulkAction(status: string) {
    const targets = applications.filter(a => selected.has(a.id) && (a.status === 'pending' || a.status === 'waitlist'));
    if (targets.length === 0) { error = 'No pending/waitlist applications selected.'; setTimeout(() => error = '', 3000); return; }
    if (!confirm(`${status === 'approved' ? 'Approve' : 'Reject'} ${targets.length} application(s)?`)) return;
    for (const app of targets) await updateStatus(app.id, status);
    selected = new Set(); selectAll = false;
  }

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

  // ── Requirements modal ──────────────────────────────────────────────────────
  async function openRequirements(app: Application) {
    reqModalApp  = app;
    reqFiles     = [];
    reqError     = '';
    reqLoading   = true;
    showReqModal = true;
    reqDialogEl?.showModal();
    try {
      reqFiles = await apiFetch(`/applications/${app.id}/requirements`);
    } catch (e) {
      reqError = e instanceof Error ? e.message : 'Failed to load requirements';
    } finally {
      reqLoading = false;
    }
  }

  function closeRequirements() {
    reqDialogEl?.close();
    showReqModal = false;
    reqModalApp  = null;
    reqFiles     = [];
    lightboxOpen = false;
    lightboxUrl  = '';
  }

  function openLightbox(url: string) {
    lightboxUrl  = url;
    lightboxOpen = true;
  }

  function isImage(fileType: string) {
    return fileType.startsWith('image/');
  }

  function isPdf(fileType: string) {
    return fileType === 'application/pdf';
  }

  function handleReqKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (lightboxOpen) { lightboxOpen = false; lightboxUrl = ''; }
      else closeRequirements();
    }
  }

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

<!-- ── Requirements Modal ──────────────────────────────────────────────────── -->
<dialog
  bind:this={reqDialogEl}
  onkeydown={handleReqKeydown}
  class="p-0 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] backdrop:bg-black/50 backdrop:backdrop-blur-sm open:flex open:flex-col"
  style="border: none;"
>
  {#if showReqModal}
    <!-- Modal Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0" style="background: #0A1F44;">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: rgba(255,255,255,0.12);">
          <FileScan size={17} style="color: white;" />
        </div>
        <div>
          <h2 class="font-bold text-white text-sm leading-tight">Submitted Requirements</h2>
          {#if reqModalApp}
            <p class="text-white/50 text-xs">{reqModalApp.full_name} · {reqModalApp.program_title ?? 'Unknown Program'}</p>
          {/if}
        </div>
      </div>
      <button onclick={closeRequirements}
        class="p-1.5 rounded-lg transition text-white/40 hover:text-white hover:bg-white/10">
        <X size={18} />
      </button>
    </div>

    <!-- Modal Body -->
    <div class="overflow-y-auto flex-1 px-6 py-5">
      {#if reqLoading}
        <div class="flex items-center justify-center gap-3 py-16 text-gray-400">
          <div class="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin" style="border-top-color: #0A1F44;"></div>
          <span class="text-sm">Loading submitted files...</span>
        </div>

      {:else if reqError}
        <div class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <X size={15} class="shrink-0" /> {reqError}
        </div>

      {:else if reqFiles.length === 0}
        <div class="flex flex-col items-center justify-center py-16 text-gray-400">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style="background: #f1f5f9;">
            <FileText size={26} style="color: #cbd5e1;" />
          </div>
          <p class="text-sm font-medium text-gray-500">No files submitted</p>
          <p class="text-xs text-gray-400 mt-1">This applicant has not uploaded any requirement files.</p>
        </div>

      {:else}
        <p class="text-xs text-gray-400 mb-4">{reqFiles.length} file{reqFiles.length !== 1 ? 's' : ''} submitted</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {#each reqFiles as file}
            <div class="border border-gray-100 rounded-2xl overflow-hidden bg-white hover:border-gray-200 hover:shadow-sm transition-all">

              <!-- Image preview -->
              {#if isImage(file.file_type)}
                <button
                  type="button"
                  onclick={() => openLightbox(file.file_url)}
                  class="w-full h-40 overflow-hidden relative group block"
                  style="background: #f8fafc;"
                >
                  <img
                    src={file.file_url}
                    alt={file.requirement_label ?? file.file_name}
                    class="w-full h-full object-cover"
                  />
                  <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                       style="background: rgba(10,31,68,0.45);">
                    <div class="flex items-center gap-2 bg-white/90 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-800">
                      <Eye size={13} /> View full size
                    </div>
                  </div>
                </button>

              <!-- PDF preview placeholder -->
              {:else if isPdf(file.file_type)}
                <div class="w-full h-40 flex flex-col items-center justify-center gap-2"
                     style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);">
                  <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: #dc2626;">
                    <FileText size={22} style="color: white;" />
                  </div>
                  <span class="text-xs font-semibold text-red-700">PDF Document</span>
                </div>

              <!-- Generic file -->
              {:else}
                <div class="w-full h-40 flex flex-col items-center justify-center gap-2"
                     style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);">
                  <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: #0284c7;">
                    <FileImage size={22} style="color: white;" />
                  </div>
                  <span class="text-xs font-semibold text-sky-700">{file.file_type.split('/')[1]?.toUpperCase() ?? 'File'}</span>
                </div>
              {/if}

              <!-- File info + actions -->
              <div class="px-3 py-3">
                {#if file.requirement_label}
                  <p class="text-xs font-semibold text-gray-800 truncate mb-0.5">{file.requirement_label}</p>
                {/if}
                <p class="text-xs text-gray-400 truncate mb-2">{file.file_name}</p>
                {#if file.uploaded_at}
                  <p class="text-[10px] text-gray-300 mb-2">
                    Uploaded {new Date(file.uploaded_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                {/if}
                <div class="flex gap-2">
                  {#if isImage(file.file_type)}
                    <button
                      type="button"
                      onclick={() => openLightbox(file.file_url)}
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex-1 justify-center"
                      style="background: #f0f7ff; color: #0A1F44; border: 1px solid #bfdbfe;"
                    >
                      <Eye size={12} /> View
                    </button>
                  {/if}
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex-1 justify-center no-underline"
                    style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;"
                  >
                    <Download size={12} /> Download
                  </a>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition justify-center no-underline"
                    style="background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0;"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Modal Footer -->
    <div class="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
      <button onclick={closeRequirements}
        class="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
        Close
      </button>
    </div>
  {/if}
</dialog>

<!-- ── Lightbox (image full-size viewer) ───────────────────────────────────── -->
{#if lightboxOpen}
  <div
    class="fixed inset-0 z-60 flex items-center justify-center p-4"
    style="background: rgba(0,0,0,0.85);"
    role="button"
    tabindex="-1"
    onclick={() => { lightboxOpen = false; lightboxUrl = ''; }}
    onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') { lightboxOpen = false; lightboxUrl = ''; } }}
  >
    <button
      onclick={(e) => { e.stopPropagation(); lightboxOpen = false; lightboxUrl = ''; }}
      class="absolute top-4 right-4 p-2 rounded-full transition"
      style="background: rgba(255,255,255,0.15); color: white;"
    >
      <X size={20} />
    </button>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <img
      src={lightboxUrl}
      alt="Requirement"
      class="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    />
  </div>
{/if}

<div class="p-4 sm:p-6 space-y-5">

  <!-- Page Header -->
  <div class="flex items-start sm:items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Applications</h1>
      <p class="text-gray-500 text-sm">Review and manage applicant submissions</p>
    </div>
    {#if applications.length > 0}
      <button onclick={exportToExcel}
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition">
        <Download size={15} /> Export Excel
      </button>
    {/if}
  </div>

  {#if error}
    <div class="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
  {/if}
  {#if success}
    <div class="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{success}</div>
  {/if}

  <!-- Filter Bar -->
  <div class="card space-y-3">
    <div class="flex flex-wrap gap-3 items-end">

      <div class="flex-1 min-w-45">
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

      <div class="w-full sm:w-40">
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

      <div class="flex-1 min-w-45">
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

    <!-- Date Range -->
    <div class="flex flex-wrap gap-3 items-end">
      <div class="w-full sm:w-44">
        <label class="label flex items-center gap-1.5" for="date-from">
          <CalendarDays size={13} class="text-gray-400" /> From
        </label>
        <input id="date-from" type="date" bind:value={dateFrom} onchange={loadApplications} class="input" />
      </div>
      <div class="w-full sm:w-44">
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
              class="ml-1 hover:opacity-60 transition">×</button>
          </span>
        </div>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="text-gray-400 text-sm">Loading applications...</div>

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
    <div class="card overflow-hidden p-0">

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

      <!-- Desktop Table -->
      <div class="hidden sm:block overflow-x-auto">
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
                  <div class="flex gap-1.5 flex-wrap items-center">
                    <!-- View Requirements button — always visible -->
                    <button
                      class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                      style="background: #f0f7ff; color: #0A1F44; border: 1px solid #bfdbfe;"
                      onclick={() => openRequirements(app)}
                      title="View submitted requirements"
                    >
                      <FileScan size={12} /> Requirements
                    </button>

                    {#if app.status === 'pending' || app.status === 'waitlist'}
                      <button class="btn-success flex items-center gap-1" onclick={() => updateStatus(app.id, 'approved')}>
                        <ThumbsUp size={12} /> Approve
                      </button>
                      <button class="btn-warning flex items-center gap-1" onclick={() => updateStatus(app.id, 'waitlist')}>
                        <Clock size={12} /> Waitlist
                      </button>
                      <button class="btn-danger flex items-center gap-1" onclick={() => updateStatus(app.id, 'rejected')}>
                        <Ban size={12} /> Reject
                      </button>
                    {:else}
                      <span class="text-gray-400 text-xs flex items-center gap-1">
                        <CheckCircle size={11} /> Processed
                      </span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards -->
      <div class="sm:hidden divide-y divide-gray-100">
        {#each applications as app}
          <div class="p-4 {selected.has(app.id) ? 'bg-blue-50/40' : ''}">
            <div class="flex items-start gap-3">
              <button onclick={() => toggleSelect(app.id)} class="mt-0.5 text-gray-400 hover:text-gray-600 shrink-0">
                {#if selected.has(app.id)}
                  <CheckSquare size={16} class="text-blue-600" />
                {:else}
                  <Square size={16} />
                {/if}
              </button>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2 mb-1">
                  <span class="font-semibold text-sm text-gray-900 leading-tight">{app.full_name}</span>
                  <span class="{statusClass[app.status] ?? 'badge-pending'} shrink-0">{app.status}</span>
                </div>
                {#if !selectedProgramId && app.program_title}
                  <p class="text-xs text-gray-400 mb-2 truncate">{app.program_title}</p>
                {/if}
                <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500 mb-3">
                  <span>Age: <strong class="text-gray-700">{app.age}</strong></span>
                  <span class="truncate"> {app.contact}</span>
                  <span class="col-span-2 truncate"> {app.address}</span>
                </div>
                <div class="flex gap-1.5 flex-wrap">
                  <!-- View Requirements button on mobile -->
                  <button
                    class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                    style="background: #f0f7ff; color: #0A1F44; border: 1px solid #bfdbfe;"
                    onclick={() => openRequirements(app)}
                  >
                    <FileScan size={11} /> Requirements
                  </button>

                  {#if app.status === 'pending' || app.status === 'waitlist'}
                    <button class="btn-success flex items-center gap-1" onclick={() => updateStatus(app.id, 'approved')}>
                      <ThumbsUp size={11} /> Approve
                    </button>
                    <button class="btn-warning flex items-center gap-1" onclick={() => updateStatus(app.id, 'waitlist')}>
                      <Clock size={11} /> Waitlist
                    </button>
                    <button class="btn-danger flex items-center gap-1" onclick={() => updateStatus(app.id, 'rejected')}>
                      <Ban size={11} /> Reject
                    </button>
                  {:else}
                    <span class="text-gray-400 text-xs flex items-center gap-1">
                      <CheckCircle size={11} /> Processed
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>

    </div>
  {/if}

</div>