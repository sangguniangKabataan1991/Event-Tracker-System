<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { apiFetch } from '$lib/api';
  import { get } from 'svelte/store';
  import { token } from '$lib/api';
  import * as XLSX from 'xlsx';

  import Search            from 'lucide-svelte/icons/search';
  import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';
  import ChevronDown       from 'lucide-svelte/icons/chevron-down';
  import ChevronRight      from 'lucide-svelte/icons/chevron-right';
  import CheckCircle       from 'lucide-svelte/icons/check-circle';
  import XCircle           from 'lucide-svelte/icons/x-circle';
  import Clock             from 'lucide-svelte/icons/clock';
  import AlertTriangle     from 'lucide-svelte/icons/alert-triangle';
  import Users             from 'lucide-svelte/icons/users';
  import X                 from 'lucide-svelte/icons/x';
  import MapPin            from 'lucide-svelte/icons/map-pin';
  import Phone             from 'lucide-svelte/icons/phone';
  import UserCheck         from 'lucide-svelte/icons/user-check';
  import FileText          from 'lucide-svelte/icons/file-text';
  import Download          from 'lucide-svelte/icons/download';
  import Eye               from 'lucide-svelte/icons/eye';
  import FileDown          from 'lucide-svelte/icons/file-down';
  import CheckSquare       from 'lucide-svelte/icons/check-square';
  import Square            from 'lucide-svelte/icons/square';
  import MinusSquare       from 'lucide-svelte/icons/minus-square';
  import Loader2           from 'lucide-svelte/icons/loader-2';

  // ── Types ─────────────────────────────────────────────────────────────────

  interface Application {
    id: number;
    full_name: string;
    address: string;
    age: number;
    contact: string;
    barangay?: string;
    status: string;
    notes?: string;
    requirements_submitted?: string;
    program_id: number;
    program_title: string;
    applicant_id: number;
    created_at: string;
    reviewed_at?: string;
    file_count: number;
    beneficiary_id?: number;
  }

  interface Program { id: number; title: string; }

  interface RequirementFile {
    id: number;
    application_id: number;
    file_name: string;
    file_url: string;
    file_type: string;
    requirement_label?: string;
    uploaded_at: string;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  let applications    = $state<Application[]>([]);
  let programs        = $state<Program[]>([]);
  let loading         = $state(true);
  let error           = $state('');

  let filterStatus    = $state('');
  let filterProgram   = $state('');
  let search          = $state('');
  let dateFrom        = $state('');
  let dateTo          = $state('');

  let collapsedGroups = $state<Set<string>>(new Set());

  // ── Bulk selection state ───────────────────────────────────────────────────
  let selectedByProgram = $state<Map<string, Set<number>>>(new Map());

  type BulkAction = 'approve' | 'reject' | 'waitlist' | 'receive' | null;
  let bulkActionByProgram   = $state<Map<string, BulkAction>>(new Map());
  let bulkLoadingByProgram  = $state<Map<string, boolean>>(new Map());
  let bulkRejectNotes       = $state<Map<string, string>>(new Map());
  let bulkRejectBoxProgram  = $state<string | null>(null);
  let bulkReceiveConfirmProgram = $state<string | null>(null);

  // detail modal
  let showDetail    = $state(false);
  let detailApp     = $state<Application | null>(null);
  let activeTab     = $state<'info' | 'requirements'>('info');
  let actionLoading = $state(false);
  let actionError   = $state('');
  let actionSuccess = $state('');
  let rejectNotes   = $state('');
  let showRejectBox = $state(false);

  // requirements
  let requirements     = $state<RequirementFile[]>([]);
  let reqLoading       = $state(false);
  let reqError         = $state('');
  let lightboxUrl      = $state('');
  let lightboxType     = $state('');
  let showLightbox     = $state(false);
  let downloadingId    = $state<number | null>(null);

  // global feedback
  let globalSuccess = $state('');
  let globalError   = $state('');

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onMount(async () => {
    try {
      const statusParam  = page.url.searchParams.get('status')  ?? '';
      const programParam = page.url.searchParams.get('program') ?? '';
      const fromParam    = page.url.searchParams.get('from')    ?? '';
      const toParam      = page.url.searchParams.get('to')      ?? '';
      if (statusParam)  filterStatus  = statusParam;
      if (programParam) filterProgram = programParam;
      if (fromParam)    dateFrom      = fromParam;
      if (toParam)      dateTo        = toParam;

      const params = new URLSearchParams();
      if (fromParam) params.set('from', fromParam);
      if (toParam)   params.set('to',   toParam);

      [applications, programs] = await Promise.all([
        apiFetch(`/applications?${params.toString()}`),
        apiFetch('/programs'),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load applications';
    } finally {
      loading = false;
    }
  });

  async function reload() {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo)   params.set('to',   dateTo);
    applications = await apiFetch(`/applications?${params.toString()}`);
    selectedByProgram = new Map();
    bulkReceiveConfirmProgram = null;
    bulkRejectBoxProgram = null;
  }

  async function applyDateFilter() {
    loading = true;
    try { await reload(); } finally { loading = false; }
  }

  async function clearDateFilter() {
    dateFrom = ''; dateTo = ''; loading = true;
    try { await reload(); } finally { loading = false; }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  let filtered = $derived(
    applications.filter(a => {
      const effective    = a.beneficiary_id ? 'received' : a.status;
      const matchStatus  = !filterStatus  || effective === filterStatus;
      const matchProgram = !filterProgram || String(a.program_id) === String(filterProgram);
      const matchSearch  = !search || a.full_name.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchProgram && matchSearch;
    })
  );

  let grouped = $derived(
    filtered.reduce<Record<string, Application[]>>((acc, a) => {
      const key = a.program_title || 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(a);
      return acc;
    }, {})
  );

  let pendingCount  = $derived(applications.filter(a => a.status === 'pending').length);
  let approvedCount = $derived(applications.filter(a => a.status === 'approved' && !a.beneficiary_id).length);
  let rejectedCount = $derived(applications.filter(a => a.status === 'rejected').length);
  let receivedCount = $derived(applications.filter(a => !!a.beneficiary_id).length);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function displayStatus(a: Application) {
    return a.beneficiary_id ? 'received' : a.status;
  }

  function statusBadge(a: Application) {
    const s = displayStatus(a);
    if (s === 'received') return 'bg-teal-100 text-teal-700';
    if (s === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (s === 'rejected') return 'bg-red-100 text-red-700';
    if (s === 'pending')  return 'bg-amber-100 text-amber-700';
    if (s === 'waitlist') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-500';
  }

  function toggleGroup(key: string) {
    const next = new Set(collapsedGroups);
    next.has(key) ? next.delete(key) : next.add(key);
    collapsedGroups = next;
  }

  function isImage(fileType: string) { return fileType.startsWith('image/'); }

  function hasRequirements(a: Application) {
    return a.file_count > 0 || !!a.requirements_submitted?.trim();
  }

  // Returns count of non-received (selectable) applicants in a group
  function selectableCount(items: Application[]): number {
    return items.filter(a => displayStatus(a) !== 'received').length;
  }

  // ── Bulk selection helpers ─────────────────────────────────────────────────

  function getSelected(programTitle: string): Set<number> {
    return selectedByProgram.get(programTitle) ?? new Set();
  }

  function selectionState(programTitle: string, items: Application[]): 'none' | 'some' | 'all' {
    const sel = getSelected(programTitle);
    if (sel.size === 0) return 'none';
    const selectable = items.filter(a => displayStatus(a) !== 'received');
    if (selectable.length > 0 && sel.size === selectable.length) return 'all';
    return 'some';
  }

  function toggleSelectAll(programTitle: string, items: Application[]) {
    const next = new Map(selectedByProgram);
    const state = selectionState(programTitle, items);
    const selectable = items.filter(a => displayStatus(a) !== 'received');
    if (state === 'all') {
      next.set(programTitle, new Set());
    } else {
      next.set(programTitle, new Set(selectable.map(a => a.id)));
    }
    selectedByProgram = next;
    if (getSelected(programTitle).size === 0) {
      bulkReceiveConfirmProgram = null;
      bulkRejectBoxProgram = null;
    }
  }

  function toggleSelectOne(programTitle: string, id: number, app: Application) {
    if (displayStatus(app) === 'received') return;
    const next = new Map(selectedByProgram);
    const set  = new Set(getSelected(programTitle));
    set.has(id) ? set.delete(id) : set.add(id);
    next.set(programTitle, set);
    selectedByProgram = next;
    if (set.size === 0) {
      if (bulkReceiveConfirmProgram === programTitle) bulkReceiveConfirmProgram = null;
      if (bulkRejectBoxProgram === programTitle) bulkRejectBoxProgram = null;
    }
  }

  function clearSelection(programTitle: string) {
    const next = new Map(selectedByProgram);
    next.set(programTitle, new Set());
    selectedByProgram = next;
    if (bulkReceiveConfirmProgram === programTitle) bulkReceiveConfirmProgram = null;
    if (bulkRejectBoxProgram === programTitle) bulkRejectBoxProgram = null;
  }

  function bulkAllowedActions(programTitle: string, items: Application[]): {
    canApprove: boolean;
    canReject: boolean;
    canWaitlist: boolean;
    canReceive: boolean;
    isMixed: boolean;
  } {
    const sel = getSelected(programTitle);
    const selectedItems = items.filter(a => sel.has(a.id));
    if (selectedItems.length === 0) {
      return { canApprove: false, canReject: false, canWaitlist: false, canReceive: false, isMixed: false };
    }
    const statuses = new Set(selectedItems.map(a => displayStatus(a)));
    const allPending  = [...statuses].every(s => s === 'pending');
    const allApproved = [...statuses].every(s => s === 'approved');
    const isMixed     = statuses.size > 1;
    return {
      canApprove:  allPending,
      canReject:   allPending,
      canWaitlist: allPending,
      canReceive:  allApproved,
      isMixed,
    };
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  async function bulkUpdateStatus(programTitle: string, status: string, notes?: string) {
    const ids = Array.from(getSelected(programTitle));
    if (!ids.length) return;

    const nextLoading = new Map(bulkLoadingByProgram);
    nextLoading.set(programTitle, true);
    bulkLoadingByProgram = nextLoading;

    try {
      await Promise.all(
        ids.map(id => apiFetch(`/applications/${id}/status`, {
          method: 'PATCH',
          body: { status, notes: notes || null },
        }))
      );
      globalSuccess = `${ids.length} application${ids.length > 1 ? 's' : ''} marked as ${status}.`;
      bulkRejectBoxProgram = null;
      await reload();
      setTimeout(() => globalSuccess = '', 4000);
    } catch (e) {
      globalError = e instanceof Error ? e.message : 'Bulk action failed';
      setTimeout(() => globalError = '', 4000);
    } finally {
      const nl = new Map(bulkLoadingByProgram);
      nl.set(programTitle, false);
      bulkLoadingByProgram = nl;
    }
  }

  async function bulkReceive(programTitle: string) {
    const ids = Array.from(getSelected(programTitle));
    if (!ids.length) return;

    const nextLoading = new Map(bulkLoadingByProgram);
    nextLoading.set(programTitle, true);
    bulkLoadingByProgram = nextLoading;

    try {
      await Promise.all(
        ids.map(id => apiFetch(`/applications/${id}/receive`, { method: 'POST' }))
      );
      globalSuccess = `${ids.length} applicant${ids.length > 1 ? 's' : ''} marked as received and added to beneficiaries.`;
      bulkReceiveConfirmProgram = null;
      await reload();
      setTimeout(() => globalSuccess = '', 4000);
    } catch (e) {
      globalError = e instanceof Error ? e.message : 'Failed to mark as received';
      bulkReceiveConfirmProgram = null;
      setTimeout(() => globalError = '', 4000);
    } finally {
      const nl = new Map(bulkLoadingByProgram);
      nl.set(programTitle, false);
      bulkLoadingByProgram = nl;
    }
  }

  // ── Export Excel ──────────────────────────────────────────────────────────

  function exportProgramExcel(programTitle: string, items: Application[]) {
    const rows = items.map((a, i) => ({
      '#':          i + 1,
      'Name':       a.full_name,
      'Address':    a.address,
      'Age':        a.age ?? '',
      'Barangay':   a.barangay ?? '',
      'Contact':    a.contact,
      'Status':     displayStatus(a),
      'Applied On': fmtDate(a.created_at),
      'Notes':      a.notes ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Applications');
    const safe = programTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(wb, `applications_${safe}_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  // ── Detail modal ──────────────────────────────────────────────────────────

  async function openDetail(a: Application, tab: 'info' | 'requirements' = 'info') {
    detailApp     = a;
    showDetail    = true;
    activeTab     = tab;
    actionError   = '';
    actionSuccess = '';
    rejectNotes   = a.notes || '';
    showRejectBox = false;
    requirements  = [];
    reqError      = '';
    if (tab === 'requirements') await loadRequirements(a.id);
  }

  function closeDetail() { showDetail = false; detailApp = null; showLightbox = false; }

  async function switchTab(tab: 'info' | 'requirements') {
    activeTab = tab;
    if (tab === 'requirements' && detailApp && requirements.length === 0) {
      await loadRequirements(detailApp.id);
    }
  }

  async function loadRequirements(appId: number) {
    reqLoading = true; reqError = '';
    try {
      requirements = await apiFetch(`/applications/${appId}/requirements`);
    } catch (e) {
      reqError = e instanceof Error ? e.message : 'Failed to load files';
    } finally {
      reqLoading = false;
    }
  }

  async function downloadFile(file: RequirementFile) {
    downloadingId = file.id;
    try {
      const t = get(token);
      const res = await fetch(file.file_url, {
        headers: t ? { Authorization: `Bearer ${t}` } : {}
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = file.file_name; a.click();
      URL.revokeObjectURL(url);
    } catch {
      reqError = 'Download failed. Please try again.';
    } finally {
      downloadingId = null;
    }
  }

  function openLightbox(file: RequirementFile) {
    lightboxUrl = file.file_url; lightboxType = file.file_type; showLightbox = true;
  }

  async function updateStatus(appId: number, status: string, notes?: string) {
    actionLoading = true; actionError = ''; actionSuccess = '';
    try {
      await apiFetch(`/applications/${appId}/status`, {
        method: 'PATCH',
        body: { status, notes: notes || null },
      });
      actionSuccess = `Application marked as ${status}.`;
      showRejectBox = false;
      await reload();
      if (detailApp?.id === appId) {
        detailApp = { ...detailApp, status, notes: notes || detailApp.notes };
      }
      setTimeout(() => { actionSuccess = ''; }, 3000);
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Action failed';
    } finally {
      actionLoading = false;
    }
  }

  async function markReceivedSingle(a: Application) {
    actionLoading = true; actionError = ''; actionSuccess = '';
    try {
      const res = await apiFetch(`/applications/${a.id}/receive`, { method: 'POST' });
      globalSuccess = res.message ?? 'Marked as received.';
      await reload();
      closeDetail();
      setTimeout(() => globalSuccess = '', 4000);
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Failed to mark as received';
    } finally {
      actionLoading = false;
    }
  }
</script>

<!-- ══ LIGHTBOX ══════════════════════════════════════════════════════════════ -->
{#if showLightbox}
  <div class="fixed inset-0 z-80 flex items-center justify-center p-4"
    style="background: rgba(0,0,0,0.88);"
    role="button" tabindex="-1"
    onclick={() => showLightbox = false}
    onkeydown={(e) => e.key === 'Escape' && (showLightbox = false)}>
    <button onclick={() => showLightbox = false}
      class="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition">
      <X size={20} />
    </button>
    {#if lightboxType === 'application/pdf'}
      <button type="button" aria-label="PDF viewer"
        class="w-full max-w-3xl h-[80vh] p-0 bg-transparent cursor-default"
        onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
        <iframe src={lightboxUrl} title="PDF viewer" role="document"
          class="w-full h-full rounded-xl border-0"></iframe>
      </button>
    {:else}
      <button type="button" class="contents"
        onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
        <img src={lightboxUrl} alt="Requirement"
          class="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
      </button>
    {/if}
  </div>
{/if}

<!-- ══ DETAIL MODAL ══════════════════════════════════════════════════════════ -->
{#if showDetail && detailApp}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
    style="background: rgba(0,0,0,0.45); backdrop-filter: blur(3px);"
    role="button" tabindex="-1"
    onclick={closeDetail}
    onkeydown={(e) => e.key === 'Escape' && closeDetail()}>
    <div role="dialog" aria-modal="true" tabindex="-1"
      class="relative bg-white w-full sm:max-w-md flex flex-col overflow-hidden
             rounded-t-2xl sm:rounded-2xl shadow-2xl"
      style="max-height: 92vh;"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}>

      <div class="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
        <div class="w-10 h-1 rounded-full bg-gray-200"></div>
      </div>

      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
        <div class="min-w-0">
          <h2 class="font-bold text-gray-900 text-base">Application Details</h2>
          <p class="text-xs text-gray-400 mt-0.5 truncate">{detailApp.program_title}</p>
        </div>
        <button onclick={closeDetail}
          class="ml-2 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition shrink-0">
          <X size={18} />
        </button>
      </div>

      <div class="flex border-b border-gray-100 px-5 shrink-0">
        <button onclick={() => switchTab('info')}
          class="flex items-center gap-1.5 px-1 py-3 text-sm font-medium border-b-2 mr-5 transition-colors
                 {activeTab === 'info' ? 'border-[#0A1F44] text-[#0A1F44]' : 'border-transparent text-gray-400 hover:text-gray-600'}">
          <Users size={14}/> Info
        </button>
        <button onclick={() => switchTab('requirements')}
          class="flex items-center gap-1.5 px-1 py-3 text-sm font-medium border-b-2 transition-colors
                 {activeTab === 'requirements' ? 'border-[#0A1F44] text-[#0A1F44]' : 'border-transparent text-gray-400 hover:text-gray-600'}">
          <FileText size={14}/> Requirements
          {#if hasRequirements(detailApp)}
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#0A1F44]/10 text-[#0A1F44]">
              {detailApp.file_count > 0 ? detailApp.file_count : '✓'}
            </span>
          {/if}
        </button>
      </div>

      <div class="overflow-y-auto flex-1 px-5 py-4 space-y-3">

        {#if activeTab === 'info'}

          <div class="flex flex-col items-center text-center gap-2 pt-1">
            <div class="w-14 h-14 rounded-full bg-[#0A1F44] flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {detailApp.full_name.charAt(0)}
            </div>
            <div>
              <div class="text-lg font-bold text-gray-900">{detailApp.full_name}</div>
              <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1 {statusBadge(detailApp)}">
                {displayStatus(detailApp)}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-2">
            <div class="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <MapPin size={15} class="mt-0.5 shrink-0 text-gray-400" />
              <div class="min-w-0">
                <div class="text-xs text-gray-400 font-medium mb-0.5">Address</div>
                <div class="text-sm text-gray-800 wrap-break-word">{detailApp.address}</div>
              </div>
            </div>
            <div class="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <Phone size={15} class="shrink-0 text-gray-400" />
              <div>
                <div class="text-xs text-gray-400 font-medium mb-0.5">Contact</div>
                <div class="text-sm text-gray-800">{detailApp.contact || '—'}</div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-gray-50 rounded-xl px-4 py-3">
                <div class="text-xs text-gray-400 font-medium mb-0.5">Age</div>
                <div class="text-sm text-gray-800">{detailApp.age || '—'}</div>
              </div>
              <div class="bg-gray-50 rounded-xl px-4 py-3">
                <div class="text-xs text-gray-400 font-medium mb-0.5">Barangay</div>
                <div class="text-sm text-gray-800">{detailApp.barangay || '—'}</div>
              </div>
            </div>
            <div class="bg-gray-50 rounded-xl px-4 py-3">
              <div class="text-xs text-gray-400 font-medium mb-0.5">Applied on</div>
              <div class="text-sm text-gray-800">{fmtDate(detailApp.created_at)}</div>
            </div>
            {#if detailApp.notes}
              <div class="flex items-start gap-3 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
                <AlertTriangle size={15} class="mt-0.5 shrink-0 text-yellow-500" />
                <div>
                  <div class="text-xs text-yellow-600 font-medium mb-0.5">Notes / Remarks</div>
                  <div class="text-sm text-gray-800">{detailApp.notes}</div>
                </div>
              </div>
            {/if}
          </div>

          {#if actionSuccess}
            <div class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <CheckCircle size={14} class="shrink-0" /> {actionSuccess}
            </div>
          {/if}
          {#if actionError}
            <div class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <X size={14} class="shrink-0" /> {actionError}
            </div>
          {/if}

          {#if showRejectBox}
            <div class="space-y-2">
              <label for="reject-notes" class="text-xs font-medium text-gray-600">Reason for rejection (optional)</label>
              <textarea id="reject-notes" bind:value={rejectNotes} rows={3}
                class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                placeholder="Enter reason..."></textarea>
              <div class="flex gap-2">
                <button onclick={() => updateStatus(detailApp!.id, 'rejected', rejectNotes)}
                  disabled={actionLoading}
                  class="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition">
                  {actionLoading ? 'Saving...' : 'Confirm Reject'}
                </button>
                <button onclick={() => { showRejectBox = false; }}
                  class="px-4 py-2 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          {/if}

          {#if detailApp.status === 'pending'}
            {#if !showRejectBox}
              <div class="flex gap-2 pt-1">
                <button onclick={() => updateStatus(detailApp!.id, 'approved')}
                  disabled={actionLoading}
                  class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition">
                  <CheckCircle size={15}/> Approve
                </button>
                <button onclick={() => { showRejectBox = true; }}
                  disabled={actionLoading}
                  class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition">
                  <XCircle size={15}/> Reject
                </button>
                <button onclick={() => updateStatus(detailApp!.id, 'waitlist')}
                  disabled={actionLoading}
                  class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-60 transition">
                  <Clock size={15}/> Waitlist
                </button>
              </div>
            {/if}

          {:else if detailApp.status === 'approved' && !detailApp.beneficiary_id}
            <button onclick={() => markReceivedSingle(detailApp!)}
              disabled={actionLoading}
              class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition">
              {#if actionLoading}
                <Loader2 size={15} class="animate-spin"/> Processing...
              {:else}
                <UserCheck size={15}/> Mark as Received (Add to Beneficiaries)
              {/if}
            </button>
            <button onclick={() => updateStatus(detailApp!.id, 'pending')}
              disabled={actionLoading}
              class="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
              <Clock size={14}/> Move back to Pending
            </button>

          {:else if detailApp.status === 'approved' && detailApp.beneficiary_id}
            <div class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
              <CheckCircle size={15}/> Already added to beneficiaries
            </div>

          {:else if detailApp.status === 'rejected' || detailApp.status === 'waitlist'}
            <button onclick={() => updateStatus(detailApp!.id, 'pending')}
              disabled={actionLoading}
              class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition">
              <Clock size={15}/> Move back to Pending
            </button>
          {/if}

        {:else if activeTab === 'requirements'}

          {#if reqLoading}
            <div class="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
              <div class="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin" style="border-top-color:#0A1F44;"></div>
              Loading files...
            </div>
          {:else if reqError}
            <div class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <X size={14} class="shrink-0" /> {reqError}
            </div>
          {:else}
            {#if detailApp.requirements_submitted?.trim()}
              <div class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <div class="flex items-center gap-1.5 mb-2">
                  <FileText size={13} class="text-amber-600 shrink-0" />
                  <span class="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Submitted Requirements
                  </span>
                </div>
                <p class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {detailApp.requirements_submitted}
                </p>
              </div>
            {/if}
            {#if requirements.length > 0}
              <div class="space-y-2">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Uploaded Files</p>
                {#each requirements as file}
                  <div class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 hover:border-slate-300 transition">
                    <button onclick={() => openLightbox(file)}
                      class="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white border border-slate-200 flex items-center justify-center hover:border-slate-400 transition">
                      {#if isImage(file.file_type)}
                        <img src={file.file_url} alt={file.file_name} class="w-full h-full object-cover" />
                      {:else}
                        <FileText size={18} class="text-red-400" />
                      {/if}
                    </button>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-800 truncate">{file.file_name}</div>
                      {#if file.requirement_label}
                        <div class="text-xs text-[#0A1F44] font-medium mt-0.5">{file.requirement_label}</div>
                      {/if}
                      <div class="text-xs text-gray-400 mt-0.5">{fmtDate(file.uploaded_at)}</div>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <button onclick={() => openLightbox(file)} title="View"
                        class="p-1.5 rounded-lg text-gray-400 hover:text-[#0A1F44] hover:bg-white transition">
                        <Eye size={15} />
                      </button>
                      <button onclick={() => downloadFile(file)} disabled={downloadingId === file.id} title="Download"
                        class="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-white disabled:opacity-50 transition">
                        {#if downloadingId === file.id}
                          <div class="w-3.5 h-3.5 border-2 border-gray-300 rounded-full animate-spin" style="border-top-color:#059669;"></div>
                        {:else}
                          <Download size={15} />
                        {/if}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
            {#if !detailApp.requirements_submitted?.trim() && requirements.length === 0}
              <div class="text-center py-12 text-gray-400">
                <FileText size={32} class="mx-auto mb-2 text-gray-300" />
                <p class="text-sm">No requirements submitted yet</p>
              </div>
            {/if}
          {/if}

        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ══ MAIN PAGE ══════════════════════════════════════════════════════════════ -->
<div class="space-y-4 p-3 sm:p-6">

  <!-- Header -->
  <div>
    <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Applications</h1>
    <p class="text-sm text-gray-500">Review and manage all program applications</p>
  </div>

  <!-- Global feedback -->
  {#if globalSuccess}
    <div class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
      <CheckCircle size={15} class="shrink-0" /> {globalSuccess}
    </div>
  {/if}
  {#if globalError}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
      <X size={15} class="shrink-0" /> {globalError}
    </div>
  {/if}

  <!-- Status filter tabs -->
  <div class="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
    {#each [
      { value: '',         label: 'All',      count: applications.length },
      { value: 'pending',  label: 'Pending',  count: pendingCount },
      { value: 'approved', label: 'Approved', count: approvedCount },
      { value: 'received', label: 'Received', count: receivedCount },
      { value: 'rejected', label: 'Rejected', count: rejectedCount },
    ] as tab}
      <button
        onclick={() => filterStatus = tab.value}
        class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition whitespace-nowrap shrink-0
               {filterStatus === tab.value
                 ? 'bg-[#0A1F44] text-white border-[#0A1F44]'
                 : 'bg-white text-gray-600 border-slate-200 hover:border-slate-300 hover:bg-gray-50'}">
        {tab.label}
        <span class="text-[11px] px-1.5 py-0.5 rounded-full font-bold
          {filterStatus === tab.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}">
          {tab.count}
        </span>
      </button>
    {/each}
  </div>

  <!-- Filters -->
  <div class="card flex flex-col gap-3 mt-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="label flex items-center gap-1.5" for="fp">
          <SlidersHorizontal size={13} class="text-gray-400" /> Filter by Program
        </label>
        <select id="fp" bind:value={filterProgram} class="input w-full">
          <option value="">All Programs</option>
          {#each programs as p}<option value={p.id}>{p.title}</option>{/each}
        </select>
      </div>
      <div>
        <label class="label flex items-center gap-1.5" for="fs">
          <Search size={13} class="text-gray-400" /> Search by name
        </label>
        <input id="fs" bind:value={search} class="input w-full" placeholder="Search applicant..." />
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="label" for="df">Date From</label>
        <input id="df" type="date" bind:value={dateFrom} class="input w-full" />
      </div>
      <div class="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div class="flex-1">
          <label class="label" for="dt">Date To</label>
          <input id="dt" type="date" bind:value={dateTo} class="input w-full" />
        </div>
        <div class="flex gap-2 shrink-0">
          <button onclick={applyDateFilter}
            class="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0A1F44] hover:bg-[#0d2a5e] transition">
            Apply
          </button>
          {#if dateFrom || dateTo}
            <button onclick={clearDateFilter}
              class="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
              Clear
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- List -->
  {#if loading}
    <div class="flex items-center gap-2 text-gray-400 text-sm py-10">
      <div class="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
      Loading applications...
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
  {:else}
    <div class="text-sm text-gray-500 px-1">
      <strong class="text-gray-800">{filtered.length}</strong> application{filtered.length === 1 ? '' : 's'} found
    </div>

    {#if Object.keys(grouped).length === 0}
      <div class="bg-white border border-slate-200 rounded-2xl text-center py-16 shadow-sm">
        <Users size={36} class="mx-auto mb-3 text-slate-300" />
        <p class="text-slate-400 text-sm">No applications found</p>
      </div>
    {/if}

    <div class="space-y-3">
      {#each Object.entries(grouped) as [programTitle, items]}
        {@const collapsed      = collapsedGroups.has(programTitle)}
        {@const sel            = getSelected(programTitle)}
        {@const selCount       = sel.size}
        {@const selState       = selectionState(programTitle, items)}
        {@const isBulkLoading  = bulkLoadingByProgram.get(programTitle) ?? false}
        {@const showRejectBar  = bulkRejectBoxProgram === programTitle}
        {@const showReceiveBar = bulkReceiveConfirmProgram === programTitle}
        {@const allowed        = bulkAllowedActions(programTitle, items)}
        {@const skippedCount   = items.filter(a => displayStatus(a) === 'received').length}

        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-slate-300 transition-all">

          <!-- Group header -->
          <div class="flex items-center gap-2 px-4 py-3 bg-slate-50/70 border-b border-slate-100">
            <!-- Select-all checkbox in header -->
            <button
              onclick={() => toggleSelectAll(programTitle, items)}
              disabled={selectableCount(items) === 0}
              class="flex items-center justify-center transition shrink-0
                     {selectableCount(items) === 0 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-[#0A1F44]'}"
              title={selState === 'all' ? 'Deselect all' : 'Select all'}>
              {#if selState === 'all'}
                <CheckSquare size={15} class="text-[#0A1F44]"/>
              {:else if selState === 'some'}
                <MinusSquare size={15} class="text-[#0A1F44]"/>
              {:else}
                <Square size={15}/>
              {/if}
            </button>
            <button onclick={() => toggleGroup(programTitle)} class="flex items-center gap-2 flex-1 min-w-0 text-left">
              <span class="text-slate-400 shrink-0">
                {#if collapsed}<ChevronRight size={15}/>{:else}<ChevronDown size={15}/>{/if}
              </span>
              <span class="font-semibold text-slate-800 text-sm truncate">{programTitle}</span>
            </button>
            <span class="flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-xs text-gray-500 shrink-0">
              <Users size={11}/> {items.length}
            </span>
            <button
              onclick={() => exportProgramExcel(programTitle, items)}
              title="Export to Excel"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition shrink-0">
              <FileDown size={12}/> Export
            </button>
          </div>

          {#if !collapsed}

            <!-- ── Bulk action toolbar ── -->
            {#if selCount > 0}
              <div class="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-[#0A1F44]/5 border-b border-[#0A1F44]/10">
                <span class="text-xs font-semibold text-[#0A1F44] shrink-0">
                  {selCount} selected
                  {#if skippedCount > 0}
                    <span class="font-normal text-gray-400 ml-1">({skippedCount} received skipped)</span>
                  {/if}
                </span>

                <div class="flex flex-wrap gap-1.5 flex-1">
                  {#if allowed.isMixed}
                    <span class="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium">
                      <AlertTriangle size={11}/> Mixed statuses — select items with the same status to apply bulk actions
                    </span>
                  {:else}
                    {#if allowed.canApprove}
                      <button
                        onclick={() => bulkUpdateStatus(programTitle, 'approved')}
                        disabled={isBulkLoading || showRejectBar || showReceiveBar}
                        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition">
                        {#if isBulkLoading}
                          <Loader2 size={11} class="animate-spin"/>
                        {:else}
                          <CheckCircle size={11}/>
                        {/if}
                        Approve
                      </button>
                    {/if}
                    {#if allowed.canReject}
                      <button
                        onclick={() => {
                          bulkRejectBoxProgram = showRejectBar ? null : programTitle;
                          bulkReceiveConfirmProgram = null;
                        }}
                        disabled={isBulkLoading}
                        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition
                               {showRejectBar ? 'ring-1 ring-red-400' : ''}">
                        <XCircle size={11}/> Reject
                      </button>
                    {/if}
                    {#if allowed.canWaitlist}
                      <button
                        onclick={() => bulkUpdateStatus(programTitle, 'waitlist')}
                        disabled={isBulkLoading || showRejectBar || showReceiveBar}
                        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition">
                        <Clock size={11}/> Waitlist
                      </button>
                    {/if}
                    {#if allowed.canReceive}
                      <button
                        onclick={() => {
                          bulkReceiveConfirmProgram = showReceiveBar ? null : programTitle;
                          bulkRejectBoxProgram = null;
                        }}
                        disabled={isBulkLoading}
                        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 disabled:opacity-50 transition
                               {showReceiveBar ? 'ring-1 ring-teal-400' : ''}">
                        <UserCheck size={11}/> Mark Received
                      </button>
                    {/if}
                  {/if}
                </div>

                <button onclick={() => clearSelection(programTitle)}
                  class="ml-auto p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0" title="Clear selection">
                  <X size={14}/>
                </button>
              </div>

              <!-- Reject notes inline bar -->
              {#if showRejectBar}
                <div class="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-100">
                  <span class="text-xs font-medium text-red-700 shrink-0">Rejection reason (optional):</span>
                  <input
                    value={bulkRejectNotes.get(programTitle) ?? ''}
                    oninput={(e) => { const next = new Map(bulkRejectNotes); next.set(programTitle, (e.target as HTMLInputElement).value); bulkRejectNotes = next; }}
                    placeholder="Enter reason..."
                    class="flex-1 min-w-40 px-3 py-1.5 rounded-lg border border-red-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  />
                  <button
                    onclick={() => bulkUpdateStatus(programTitle, 'rejected', bulkRejectNotes.get(programTitle) ?? '')}
                    disabled={isBulkLoading}
                    class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition shrink-0">
                    {isBulkLoading ? 'Saving...' : `Reject ${selCount}`}
                  </button>
                  <button onclick={() => bulkRejectBoxProgram = null}
                    class="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 transition shrink-0">
                    Cancel
                  </button>
                </div>
              {/if}

              <!-- Receive confirm inline bar -->
              {#if showReceiveBar}
                <div class="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-teal-50 border-b border-teal-100">
                  <UserCheck size={14} class="text-teal-600 shrink-0"/>
                  <span class="text-xs font-medium text-teal-800 flex-1">
                    Add <strong>{selCount} applicant{selCount > 1 ? 's' : ''}</strong> to beneficiaries under <strong>{programTitle}</strong>?
                  </span>
                  <button
                    onclick={() => bulkReceive(programTitle)}
                    disabled={isBulkLoading}
                    class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60 transition shrink-0">
                    {isBulkLoading ? 'Processing...' : 'Yes, confirm'}
                  </button>
                  <button onclick={() => bulkReceiveConfirmProgram = null}
                    class="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 transition shrink-0">
                    Cancel
                  </button>
                </div>
              {/if}
            {/if}

            <!-- Desktop table -->
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-sm" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 40px;" />
                  <col style="width: 21%;" />
                  <col style="width: 19%;" />
                  <col style="width: 7%;" />
                  <col style="width: 13%;" />
                  <col style="width: 11%;" />
                  <col style="width: 10%;" />
                  <col style="width: 12%;" />
                </colgroup>
                <thead>
                  <tr class="text-left text-gray-400 text-xs uppercase tracking-wide bg-gray-50/50">
                    <th class="pl-4 pr-2 py-2.5">
                      <!-- Empty — select-all is now in the group header -->
                    </th>
                    <th class="px-4 py-2.5 font-medium">Name</th>
                    <th class="px-4 py-2.5 font-medium">Address</th>
                    <th class="px-4 py-2.5 font-medium">Age</th>
                    <th class="px-4 py-2.5 font-medium">Contact</th>
                    <th class="px-4 py-2.5 font-medium">Applied</th>
                    <th class="px-4 py-2.5 font-medium">Status</th>
                    <th class="px-4 py-2.5 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  {#each items as a}
                    {@const isSelected = sel.has(a.id)}
                    {@const isReceived = displayStatus(a) === 'received'}
                    <tr
                      class="hover:bg-blue-50/40 transition-colors cursor-pointer {isSelected ? 'bg-[#0A1F44]/5' : ''}"
                      onclick={() => openDetail(a)}>
                      <td class="pl-4 pr-2 py-3"
                        onclick={(e) => {
                          e.stopPropagation();
                          if (!isReceived) toggleSelectOne(programTitle, a.id, a);
                        }}>
                        <button
                          disabled={isReceived}
                          class="flex items-center justify-center transition
                                 {isReceived ? 'text-gray-200 cursor-not-allowed' : 'text-gray-300 hover:text-[#0A1F44]'}">
                          {#if isSelected}
                            <CheckSquare size={15} class="text-[#0A1F44]"/>
                          {:else}
                            <Square size={15}/>
                          {/if}
                        </button>
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div class="w-7 h-7 rounded-full bg-[#0A1F44] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {a.full_name.charAt(0)}
                          </div>
                          <span class="font-medium text-gray-900 truncate">{a.full_name}</span>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-gray-500 truncate">{a.address}</td>
                      <td class="px-4 py-3 text-gray-600">{a.age || '—'}</td>
                      <td class="px-4 py-3 text-gray-600 truncate">{a.contact || '—'}</td>
                      <td class="px-4 py-3 text-gray-500 text-xs">{fmtDate(a.created_at)}</td>
                      <td class="px-4 py-3">
                        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full {statusBadge(a)}">
                          {displayStatus(a)}
                        </span>
                      </td>
                      <td class="px-3 py-3" onclick={(e) => e.stopPropagation()}>
                        <div class="flex items-center justify-center">
                          <button
                            onclick={() => openDetail(a, hasRequirements(a) ? 'requirements' : 'info')}
                            title="View Details"
                            class="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition">
                            <Eye size={11}/> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div class="md:hidden divide-y divide-gray-100">
              {#each items as a}
                {@const isSelected = sel.has(a.id)}
                {@const isReceived = displayStatus(a) === 'received'}
                <div class="flex items-center gap-3 px-4 py-3 {isSelected ? 'bg-[#0A1F44]/5' : ''}">
                  <button
                    onclick={() => { if (!isReceived) toggleSelectOne(programTitle, a.id, a); }}
                    disabled={isReceived}
                    class="flex items-center justify-center transition shrink-0
                           {isReceived ? 'text-gray-200 cursor-not-allowed' : 'text-gray-300 hover:text-[#0A1F44]'}">
                    {#if isSelected}
                      <CheckSquare size={16} class="text-[#0A1F44]"/>
                    {:else}
                      <Square size={16}/>
                    {/if}
                  </button>
                  <div class="w-9 h-9 rounded-full bg-[#0A1F44] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {a.full_name.charAt(0)}
                  </div>
                  <button class="flex-1 min-w-0 text-left" onclick={() => openDetail(a)}>
                    <div class="font-medium text-sm text-gray-900 truncate">{a.full_name}</div>
                    <div class="text-xs text-gray-400 truncate">{a.address}</div>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span class="text-xs text-gray-400">{fmtDate(a.created_at)}</span>
                      <span class="text-xs font-semibold px-1.5 py-0.5 rounded-full {statusBadge(a)}">
                        {displayStatus(a)}
                      </span>
                      {#if hasRequirements(a)}
                        <span class="text-xs text-amber-600 font-medium">
                          {a.file_count > 0 ? `· ${a.file_count} file${a.file_count > 1 ? 's' : ''}` : '· text submitted'}
                        </span>
                      {/if}
                    </div>
                  </button>
                  <button
                    onclick={() => openDetail(a, hasRequirements(a) ? 'requirements' : 'info')}
                    class="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition shrink-0">
                    <Eye size={11}/> View
                  </button>
                </div>
              {/each}
            </div>

          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>