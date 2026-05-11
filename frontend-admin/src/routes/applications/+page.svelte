<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { apiFetch } from '$lib/api.js';
  import * as XLSX from 'xlsx';
  import Search            from 'lucide-svelte/icons/search';
  import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';
  import CheckCircle       from 'lucide-svelte/icons/check-circle';
  import Clock             from 'lucide-svelte/icons/clock';
  import CircleDashed      from 'lucide-svelte/icons/circle-dashed';
  import ListFilter        from 'lucide-svelte/icons/list-filter';
  import ThumbsUp          from 'lucide-svelte/icons/thumbs-up';
  import Ban               from 'lucide-svelte/icons/ban';
  import Download          from 'lucide-svelte/icons/download';
  import CalendarDays      from 'lucide-svelte/icons/calendar-days';
  import Square            from 'lucide-svelte/icons/square';
  import CheckSquare       from 'lucide-svelte/icons/check-square';
  import FileText          from 'lucide-svelte/icons/file-text';
  import X                 from 'lucide-svelte/icons/x';
  import FileImage         from 'lucide-svelte/icons/file-image';
  import FileScan          from 'lucide-svelte/icons/file-scan';
  import Eye               from 'lucide-svelte/icons/eye';
  import ExternalLink      from 'lucide-svelte/icons/external-link';
  import ChevronDown       from 'lucide-svelte/icons/chevron-down';
  import ChevronRight      from 'lucide-svelte/icons/chevron-right';
  import Users             from 'lucide-svelte/icons/users';
  import PackageCheck      from 'lucide-svelte/icons/package-check';
  import MapPin            from 'lucide-svelte/icons/map-pin';
  import Phone             from 'lucide-svelte/icons/phone';
  import User              from 'lucide-svelte/icons/user';

  type StatusKey = 'pending' | 'approved' | 'rejected' | 'waitlist';

  interface Program { id: string | number; title: string; status: string; }
  interface Application {
    id: string | number;
    full_name: string;
    address: string;
    age: number;
    contact: string;
    barangay?: string;
    status: StatusKey;
    program_id?: string | number;
    program_title?: string;
    created_at?: string;
    file_count?: number;
    requirements_submitted?: string;
    beneficiary_id?: string | number | null;
    notes?: string;
  }
  interface RequirementFile {
    id: string | number;
    file_name: string;
    file_url: string;
    file_type: string;
    requirement_label?: string;
    uploaded_at?: string;
  }
  interface ProgramGroup {
    program_id: string | number;
    program_title: string;
    applications: Application[];
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

  let selected        = $state<Set<string | number>>(new Set());
  let selectAll       = $state(false);
  let collapsedGroups = $state<Set<string | number>>(new Set());

  // ── Requirements modal ────────────────────────────────────────────────────
  let showReqModal = $state(false);
  let reqModalApp  = $state<Application | null>(null);
  let reqFiles     = $state<RequirementFile[]>([]);
  let reqLoading   = $state(false);
  let reqError     = $state('');
  let lightboxUrl  = $state('');
  let lightboxOpen = $state(false);

  // ── Reject reason modal ───────────────────────────────────────────────────
  let showRejectModal  = $state(false);
  let rejectTargetId   = $state<string | number | null>(null);
  let rejectTargetName = $state('');
  let rejectReason     = $state('');
  let rejectLoading    = $state(false);

  // ── View Full Application modal ───────────────────────────────────────────
  let showAppModal = $state(false);
  let appModalData = $state<Application | null>(null);

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
      let url = selectedProgramId
        ? `/applications/program/${selectedProgramId}?`
        : `/applications?`;
      if (filterStatus) url += `status=${filterStatus}&`;
      if (searchTerm)   url += `search=${encodeURIComponent(searchTerm)}&`;
      if (dateFrom)     url += `from=${dateFrom}&`;
      if (dateTo)       url += `to=${dateTo}&`;
      applications = await apiFetch(url);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load applications';
    } finally {
      loading = false;
    }
  }

  let programGroups = $derived<ProgramGroup[]>((() => {
    const map = new Map<string, ProgramGroup>();
    for (const app of applications) {
      const key   = String(app.program_id ?? app.program_title ?? 'unknown');
      const label = app.program_title ?? 'Unknown Program';
      if (!map.has(key)) map.set(key, { program_id: app.program_id ?? key, program_title: label, applications: [] });
      map.get(key)!.applications.push(app);
    }
    return Array.from(map.values());
  })());

  function toggleGroup(id: string | number) {
    const next = new Set(collapsedGroups);
    next.has(id) ? next.delete(id) : next.add(id);
    collapsedGroups = next;
  }

  // ── Reject modal ──────────────────────────────────────────────────────────
  function openRejectModal(id: string | number, name: string) {
    rejectTargetId   = id;
    rejectTargetName = name;
    rejectReason     = '';
    showRejectModal  = true;
  }

  async function submitReject() {
    if (!rejectTargetId) return;
    rejectLoading = true;
    try {
      await apiFetch(`/applications/${rejectTargetId}/status`, {
        method: 'PATCH',
        body: { status: 'rejected', notes: rejectReason.trim() || null },
      });
      success = 'Application rejected.';
      showRejectModal = false;
      await loadApplications();
      setTimeout(() => success = '', 3000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to reject application';
      setTimeout(() => error = '', 3000);
    } finally {
      rejectLoading = false;
    }
  }

  // ── View full application modal ───────────────────────────────────────────
  function openAppModal(app: Application) {
    appModalData = app;
    showAppModal = true;
  }
  function closeAppModal() { showAppModal = false; appModalData = null; }

  // ── Status update (non-reject) ────────────────────────────────────────────
  async function updateStatus(id: string | number, status: string, name = '') {
    if (status === 'rejected') {
      openRejectModal(id, name);
      return;
    }
    try {
      await apiFetch(`/applications/${id}/status`, { method: 'PATCH', body: { status, notes: null } });
      success = `Application marked as ${status}.`;
      await loadApplications();
      setTimeout(() => success = '', 3000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update status';
      setTimeout(() => error = '', 3000);
    }
  }

  // ── Mark as Received ──────────────────────────────────────────────────────
  async function markReceived(id: string | number, name: string) {
    if (!confirm(`Mark ${name} as received? This will add them to the Beneficiaries list.`)) return;
    try {
      await apiFetch(`/applications/${id}/receive`, { method: 'POST' });
      success = `${name} has been marked as received and added to beneficiaries.`;
      await loadApplications();
      setTimeout(() => success = '', 4000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to mark as received';
      setTimeout(() => error = '', 4000);
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

  function toggleGroupSelect(groupApps: Application[]) {
    const ids      = groupApps.map(a => a.id);
    const allInSet = ids.every(id => selected.has(id));
    const next     = new Set(selected);
    allInSet ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
    selected  = next;
    selectAll = next.size === applications.length;
  }

  function isGroupSelected(groupApps: Application[]) {
    return groupApps.length > 0 && groupApps.every(a => selected.has(a.id));
  }
  function isGroupPartial(groupApps: Application[]) {
    const n = groupApps.filter(a => selected.has(a.id)).length;
    return n > 0 && n < groupApps.length;
  }

  async function bulkAction(status: string) {
    const targets = applications.filter(a => selected.has(a.id) && (a.status === 'pending' || a.status === 'waitlist'));
    if (!targets.length) { error = 'No pending/waitlist applications selected.'; setTimeout(() => error = '', 3000); return; }
    if (!confirm(`${status === 'approved' ? 'Approve' : 'Reject'} ${targets.length} application(s)?`)) return;
    for (const app of targets) {
      if (status === 'rejected') {
        await apiFetch(`/applications/${app.id}/status`, { method: 'PATCH', body: { status: 'rejected', notes: null } });
      } else {
        await updateStatus(app.id, status);
      }
    }
    await loadApplications();
    selected = new Set(); selectAll = false;
  }

  async function approveAllInGroup(groupApps: Application[]) {
    const targets = groupApps.filter(a => a.status === 'pending' || a.status === 'waitlist');
    if (!targets.length) return;
    if (!confirm(`Approve ${targets.length} pending application(s) in this program?`)) return;
    for (const app of targets) await updateStatus(app.id, 'approved');
  }

  function exportToExcel() {
    const rows = applications.map(a => ({
      'Program':      a.program_title ?? '',
      'Name':         a.full_name,
      'Address':      a.address,
      'Age':          a.age,
      'Contact':      a.contact,
      'Status':       a.status,
      'Rejection Reason': a.notes ?? '',
      'Received':     a.beneficiary_id ? 'Yes' : 'No',
      'Files':        a.file_count ?? 0,
      'Date Applied': a.created_at ? new Date(a.created_at).toLocaleDateString('en-PH') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Applications');
    XLSX.writeFile(wb, `applications_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  // ── Requirements modal ────────────────────────────────────────────────────
  async function openRequirements(app: Application) {
    reqModalApp  = app;
    reqFiles     = [];
    reqError     = '';
    reqLoading   = true;
    showReqModal = true;
    try {
      reqFiles = await apiFetch(`/applications/${app.id}/requirements`);
    } catch (e) {
      reqError = e instanceof Error ? e.message : 'Failed to load requirements';
    } finally {
      reqLoading = false;
    }
  }

  function closeRequirements() {
    showReqModal = false;
    reqModalApp  = null;
    reqFiles     = [];
    lightboxOpen = false;
    lightboxUrl  = '';
  }

  function openLightbox(url: string) { lightboxUrl = url; lightboxOpen = true; }
  function closeLightbox() { lightboxOpen = false; lightboxUrl = ''; }

  function isImage(ft: string) { return ft.startsWith('image/'); }
  function isPdf(ft: string)   { return ft === 'application/pdf'; }

  const statusClass: Record<StatusKey, string> = {
    pending:  'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    waitlist: 'badge-waitlist',
  };
  const progStatusClass: Record<string, string> = {
    open:      'bg-emerald-100 text-emerald-700 border border-emerald-200',
    closed:    'bg-slate-100 text-slate-500 border border-slate-200',
    draft:     'bg-amber-100 text-amber-700 border border-amber-200',
    completed: 'bg-blue-100 text-blue-700 border border-blue-200',
  };

  let pendingSelected = $derived(
    applications.filter(a => selected.has(a.id) && (a.status === 'pending' || a.status === 'waitlist')).length
  );

  function fmtDate(d?: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<!-- ══ LIGHTBOX ══════════════════════════════════════════════════════════════ -->
{#if lightboxOpen}
  <div role="dialog" aria-modal="true" tabindex="-1"
    class="fixed inset-0 flex items-center justify-center p-6"
    style="background: rgba(0,0,0,0.92); z-index: 99999;"
    onkeydown={(e) => e.key === 'Escape' && closeLightbox()}>
    <button onclick={closeLightbox}
      class="absolute top-5 right-5 flex items-center justify-center w-9 h-9 rounded-full transition"
      style="background: rgba(255,255,255,0.15); color: white;" aria-label="Close">
      <X size={18}/>
    </button>
    <div class="absolute inset-0" role="button" tabindex="-1"
      onclick={closeLightbox} onkeydown={(e) => e.key === 'Escape' && closeLightbox()}></div>
    <img src={lightboxUrl} alt="Requirement preview"
      class="relative max-h-[88vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" style="z-index: 1;" />
  </div>
{/if}

<!-- ══ REJECT REASON MODAL ═══════════════════════════════════════════════════ -->
{#if showRejectModal}
  <div class="fixed inset-0 flex items-center justify-center p-4"
    style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 9500;"
    role="button" tabindex="-1"
    onclick={() => showRejectModal = false}
    onkeydown={(e) => e.key === 'Escape' && (showRejectModal = false)}>
    <div role="dialog" aria-modal="true" tabindex="-1"
      class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}>
      <div class="px-5 pt-5 pb-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <Ban size={16} class="text-red-500"/>
          </div>
          <div>
            <h2 class="font-bold text-gray-900 text-sm">Reject Application</h2>
            <p class="text-xs text-gray-400 mt-0.5 truncate max-w-55">{rejectTargetName}</p>
          </div>
          <button onclick={() => showRejectModal = false}
            class="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition shrink-0">
            <X size={15}/>
          </button>
        </div>
        <label class="text-xs font-semibold text-gray-600 block mb-1.5" for="reject-reason">
          Reason for rejection <span class="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          id="reject-reason"
          bind:value={rejectReason}
          rows="3"
          placeholder="e.g. Incomplete requirements, does not meet age requirement..."
          class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50 transition resize-none bg-slate-50"
        ></textarea>
      </div>
      <div class="flex gap-2 px-5 pb-5">
        <button onclick={submitReject} disabled={rejectLoading}
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition">
          {rejectLoading ? 'Rejecting...' : 'Confirm Reject'}
        </button>
        <button onclick={() => showRejectModal = false}
          class="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ══ VIEW FULL APPLICATION MODAL ═══════════════════════════════════════════ -->
{#if showAppModal && appModalData}
  <div class="fixed inset-0 flex items-center justify-center p-4"
    style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 9400;"
    role="button" tabindex="-1"
    onclick={closeAppModal}
    onkeydown={(e) => e.key === 'Escape' && closeAppModal()}>
    <div role="dialog" aria-modal="true" tabindex="-1"
      class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
      style="max-height: 88vh;"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}>

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 shrink-0" style="background: #0A1F44;">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {appModalData.full_name.charAt(0)}
          </div>
          <div class="min-w-0">
            <h2 class="font-bold text-white text-sm leading-tight truncate">{appModalData.full_name}</h2>
            <p class="text-white/50 text-xs mt-0.5 truncate">{appModalData.program_title ?? 'Unknown Program'}</p>
          </div>
        </div>
        <button onclick={closeAppModal}
          class="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition shrink-0 ml-3">
          <X size={16}/>
        </button>
      </div>

      <!-- Body -->
      <div class="overflow-y-auto flex-1 px-5 py-5 space-y-4">

        <!-- Status + date -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class={statusClass[appModalData.status] ?? 'badge-pending'}>{appModalData.status}</span>
          <span class="text-xs text-gray-400">Applied {fmtDate(appModalData.created_at)}</span>
        </div>

        <!-- Details grid -->
        <div class="grid grid-cols-2 gap-2.5">
          <div class="col-span-2 bg-slate-50 rounded-xl px-3.5 py-3">
            <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <User size={10}/> Full Name
            </div>
            <div class="text-sm font-medium text-slate-800">{appModalData.full_name}</div>
          </div>
          <div class="bg-slate-50 rounded-xl px-3.5 py-3">
            <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Age</div>
            <div class="text-sm font-medium text-slate-800">{appModalData.age}</div>
          </div>
          <div class="bg-slate-50 rounded-xl px-3.5 py-3">
            <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Phone size={10}/> Contact
            </div>
            <div class="text-sm font-medium text-slate-800">{appModalData.contact}</div>
          </div>
          <div class="col-span-2 bg-slate-50 rounded-xl px-3.5 py-3">
            <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <MapPin size={10}/> Address
            </div>
            <div class="text-sm font-medium text-slate-800">{appModalData.address}</div>
          </div>
          {#if appModalData.barangay}
            <div class="bg-slate-50 rounded-xl px-3.5 py-3">
              <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Barangay</div>
              <div class="text-sm font-medium text-slate-800">{appModalData.barangay}</div>
            </div>
          {/if}
          <div class="bg-slate-50 rounded-xl px-3.5 py-3">
            <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Files Uploaded</div>
            <div class="text-sm font-medium text-slate-800">{appModalData.file_count ?? 0} file(s)</div>
          </div>
        </div>

        {#if appModalData.requirements_submitted}
          <div class="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <div class="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">Requirements Note</div>
            <p class="text-sm text-slate-700 whitespace-pre-wrap">{appModalData.requirements_submitted}</p>
          </div>
        {/if}

        <!-- Rejection reason -->
        {#if appModalData.status === 'rejected' && appModalData.notes}
          <div class="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <div class="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Ban size={10}/> Rejection Reason
            </div>
            <p class="text-sm text-slate-700">{appModalData.notes}</p>
          </div>
        {:else if appModalData.status === 'rejected'}
          <div class="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <div class="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">Rejection Reason</div>
            <p class="text-xs text-slate-400 italic">No reason provided</p>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
        <button onclick={() => { const app = appModalData!; closeAppModal(); openRequirements(app); }}
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition"
          style="background:#f0f7ff; color:#0A1F44; border: 1px solid #bfdbfe;">
          <FileScan size={13}/> View Requirements
        </button>
        <button onclick={closeAppModal}
          class="ml-auto px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ══ REQUIREMENTS MODAL ═════════════════════════════════════════════════════ -->
{#if showReqModal}
  <div class="fixed inset-0 flex items-center justify-center p-4"
    style="background: rgba(0,0,0,0.5); z-index: 9000; backdrop-filter: blur(2px);"
    role="button" tabindex="-1"
    onclick={closeRequirements}
    onkeydown={(e) => e.key === 'Escape' && closeRequirements()}>
    <div role="dialog" aria-modal="true" tabindex="-1"
      class="relative flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style="background: white; width: 100%; max-width: 580px; max-height: 82vh;"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}>

      <div class="flex items-center justify-between px-5 py-4 shrink-0" style="background: #0A1F44;">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(255,255,255,0.12);">
            <FileScan size={15} style="color: white;"/>
          </div>
          <div class="min-w-0">
            <h2 class="font-bold text-white text-sm leading-tight">Submitted Requirements</h2>
            {#if reqModalApp}
              <p class="text-white/50 text-xs truncate mt-0.5">{reqModalApp.full_name} · {reqModalApp.program_title ?? 'Unknown Program'}</p>
            {/if}
          </div>
        </div>
        <button onclick={closeRequirements}
          class="p-1.5 rounded-lg transition text-white/50 hover:text-white hover:bg-white/10 shrink-0 ml-3">
          <X size={16}/>
        </button>
      </div>

      <div class="overflow-y-auto flex-1 px-5 py-4">
        {#if reqLoading}
          <div class="flex items-center justify-center gap-3 py-14 text-gray-400">
            <div class="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin" style="border-top-color: #0A1F44;"></div>
            <span class="text-sm">Loading submitted files...</span>
          </div>
        {:else if reqError}
          <div class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <X size={14} class="shrink-0"/> {reqError}
          </div>
        {:else if reqFiles.length === 0}
          <div class="flex flex-col items-center justify-center py-14 text-gray-400">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style="background: #f1f5f9;">
              <FileText size={22} style="color: #cbd5e1;"/>
            </div>
            <p class="text-sm font-medium text-gray-500">No files submitted</p>
            <p class="text-xs text-gray-400 mt-1">This applicant has not uploaded any requirement files.</p>
            {#if reqModalApp?.requirements_submitted}
              <div class="mt-4 w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                <p class="text-xs font-semibold text-slate-500 mb-1">Requirements listed (text only):</p>
                <p class="text-sm text-slate-700 whitespace-pre-wrap">{reqModalApp.requirements_submitted}</p>
              </div>
            {/if}
          </div>
        {:else}
          <p class="text-xs text-gray-400 mb-3">{reqFiles.length} file{reqFiles.length !== 1 ? 's' : ''} submitted</p>
          {#if reqModalApp?.requirements_submitted}
            <div class="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p class="text-xs font-semibold text-slate-500 mb-1">Requirements note from applicant:</p>
              <p class="text-sm text-slate-700 whitespace-pre-wrap">{reqModalApp.requirements_submitted}</p>
            </div>
          {/if}
          <div class="grid grid-cols-2 gap-3">
            {#each reqFiles as file}
              <div class="border border-gray-100 rounded-xl overflow-hidden bg-white hover:border-gray-200 hover:shadow-sm transition-all">
                {#if isImage(file.file_type)}
                  <button type="button" onclick={() => openLightbox(file.file_url)}
                    class="w-full h-32 overflow-hidden relative group block" style="background: #f8fafc;">
                    <img src={file.file_url} alt={file.requirement_label ?? file.file_name} class="w-full h-full object-cover"/>
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style="background: rgba(10,31,68,0.5);">
                      <div class="flex items-center gap-1.5 bg-white/90 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-800">
                        <Eye size={12}/> View
                      </div>
                    </div>
                  </button>
                {:else if isPdf(file.file_type)}
                  <div class="w-full h-32 flex flex-col items-center justify-center gap-2" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: #dc2626;">
                      <FileText size={18} style="color: white;"/>
                    </div>
                    <span class="text-xs font-semibold text-red-700">PDF Document</span>
                  </div>
                {:else}
                  <div class="w-full h-32 flex flex-col items-center justify-center gap-2" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: #0284c7;">
                      <FileImage size={18} style="color: white;"/>
                    </div>
                    <span class="text-xs font-semibold text-sky-700">{file.file_type.split('/')[1]?.toUpperCase() ?? 'File'}</span>
                  </div>
                {/if}
                <div class="px-3 py-2.5">
                  {#if file.requirement_label}
                    <p class="text-xs font-semibold text-gray-800 truncate mb-0.5">{file.requirement_label}</p>
                  {/if}
                  <p class="text-xs text-gray-400 truncate mb-2">{file.file_name}</p>
                  {#if file.uploaded_at}
                    <p class="text-[10px] text-gray-300 mb-2">Uploaded {fmtDate(file.uploaded_at)}</p>
                  {/if}
                  <div class="flex gap-1.5">
                    {#if isImage(file.file_type)}
                      <button type="button" onclick={() => openLightbox(file.file_url)}
                        class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition flex-1 justify-center"
                        style="background: #f0f7ff; color: #0A1F44; border: 1px solid #bfdbfe;">
                        <Eye size={11}/> View
                      </button>
                    {/if}
                    <a href={file.file_url} target="_blank" rel="noopener noreferrer"
                      class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition flex-1 justify-center no-underline"
                      style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;">
                      <Download size={11}/> Download
                    </a>
                    <a href={file.file_url} target="_blank" rel="noopener noreferrer"
                      class="flex items-center justify-center px-2 py-1.5 rounded-lg text-xs transition no-underline"
                      style="background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0;">
                      <ExternalLink size={11}/>
                    </a>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="px-5 py-3 border-t border-gray-100 flex justify-end shrink-0">
        <button onclick={closeRequirements}
          class="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ══ MAIN PAGE ══════════════════════════════════════════════════════════════ -->
<div class="p-4 sm:p-6 space-y-4 sm:space-y-5">

  <!-- Header -->
  <div class="flex items-start sm:items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Applications</h1>
      <p class="text-gray-500 text-sm">Review and manage applicant submissions</p>
    </div>
    {#if applications.length > 0}
      <button onclick={exportToExcel}
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition">
        <Download size={15}/> Export Excel
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
      <div class="flex-1 min-w-40">
        <label class="label flex items-center gap-1.5" for="prog">
          <SlidersHorizontal size={13} class="text-gray-400"/> Program
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
          <ListFilter size={13} class="text-gray-400"/> Status
        </label>
        <select id="status" bind:value={filterStatus} onchange={loadApplications} class="input">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="waitlist">Waitlist</option>
        </select>
      </div>
      <div class="flex-1 min-w-40">
        <label class="label flex items-center gap-1.5" for="search">
          <Search size={13} class="text-gray-400"/> Search by name
        </label>
        <div class="relative">
          <Search size={15} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          <input id="search" bind:value={searchTerm} oninput={loadApplications} class="input pl-8" placeholder="Search by name..."/>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-3 items-end">
      <div class="w-full sm:w-auto">
        <label class="label flex items-center gap-1.5" for="date-from">
          <CalendarDays size={13} class="text-gray-400"/> Date Applied — From
        </label>
        <input id="date-from" type="date" bind:value={dateFrom} onchange={loadApplications} class="input w-full sm:w-44"/>
      </div>
      <div class="w-full sm:w-auto">
        <label class="label flex items-center gap-1.5" for="date-to">
          <CalendarDays size={13} class="text-gray-400"/> To
        </label>
        <input id="date-to" type="date" bind:value={dateTo} onchange={loadApplications} class="input w-full sm:w-44"/>
      </div>
      {#if dateFrom || dateTo}
        <button onclick={() => { dateFrom=''; dateTo=''; loadApplications(); }}
          class="text-xs text-gray-400 hover:text-red-500 transition self-end pb-2.5">Clear dates</button>
      {/if}
      {#if filterStatus}
        <div class="self-end pb-2">
          <span class="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border
            {filterStatus==='pending'  ?'bg-amber-100 text-amber-700 border-amber-200':''}
            {filterStatus==='approved'?'bg-emerald-100 text-emerald-700 border-emerald-200':''}
            {filterStatus==='rejected'?'bg-red-100 text-red-700 border-red-200':''}
            {filterStatus==='waitlist'?'bg-blue-100 text-blue-700 border-blue-200':''}">
            Showing: {filterStatus}
            <button onclick={() => { filterStatus=''; loadApplications(); }} class="ml-1 hover:opacity-60 transition">×</button>
          </span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Bulk action bar -->
  {#if selected.size > 0}
    <div class="flex items-center gap-3 flex-wrap px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
      <span class="font-medium text-blue-800">{selected.size} selected ({pendingSelected} actionable)</span>
      <button onclick={() => bulkAction('approved')}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition">
        <CheckCircle size={13}/> Approve Selected
      </button>
      <button onclick={() => bulkAction('rejected')}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition">
        <Ban size={13}/> Reject Selected
      </button>
      <button onclick={() => { selected=new Set(); selectAll=false; }} class="ml-auto text-xs text-gray-400 hover:text-gray-600 transition">
        Clear selection
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center gap-2 text-gray-400 text-sm py-8">
      <div class="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
      Loading applications...
    </div>

  {:else if applications.length === 0}
    <div class="card text-center text-gray-400 py-16">
      <CircleDashed size={36} class="mx-auto mb-3 text-gray-300"/>
      <p class="text-sm">No applications found</p>
      {#if filterStatus}
        <button onclick={() => { filterStatus=''; loadApplications(); }} class="text-xs text-blue-500 hover:underline mt-2">Clear status filter</button>
      {/if}
    </div>

  {:else}
    <div class="flex items-center justify-between text-sm text-gray-500 px-1 flex-wrap gap-2">
      <span>
        <strong class="text-gray-800">{applications.length}</strong> application(s) in
        <strong class="text-gray-800">{programGroups.length}</strong> program(s)
      </span>
      <button onclick={toggleSelectAll} class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition">
        {#if selectAll}
          <CheckSquare size={14} class="text-blue-600"/>
        {:else}
          <Square size={14}/>
        {/if}
        Select all
      </button>
    </div>

    <!-- Program Groups -->
    <div class="space-y-3">
      {#each programGroups as group}
        {@const collapsed    = collapsedGroups.has(group.program_id)}
        {@const pendingCount = group.applications.filter(a => a.status === 'pending').length}
        {@const prog         = programs.find(p => String(p.id) === String(group.program_id))}

        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-slate-300 transition-all">

          <!-- Group Header -->
          <div class="flex items-center gap-2 sm:gap-3 px-4 py-3 bg-slate-50/70 border-b border-slate-100">
            <button onclick={() => toggleGroupSelect(group.applications)} class="text-gray-400 hover:text-gray-600 shrink-0">
              {#if isGroupSelected(group.applications)}
                <CheckSquare size={15} class="text-blue-600"/>
              {:else if isGroupPartial(group.applications)}
                <CheckSquare size={15} class="text-blue-300"/>
              {:else}
                <Square size={15}/>
              {/if}
            </button>

            <button onclick={() => toggleGroup(group.program_id)}
              class="flex items-center gap-2 flex-1 min-w-0 text-left">
              <span class="text-slate-400 shrink-0">
                {#if collapsed}<ChevronRight size={15}/>{:else}<ChevronDown size={15}/>{/if}
              </span>
              <span class="font-semibold text-slate-800 text-sm truncate">{group.program_title}</span>
              {#if prog}
                <span class="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 {progStatusClass[prog.status]??progStatusClass.closed}">
                  {prog.status}
                </span>
              {/if}
            </button>

            <div class="flex items-center gap-2 shrink-0 text-xs text-gray-500">
              <span class="flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                <Users size={11}/> {group.applications.length}
              </span>
              {#if pendingCount > 0}
                <span class="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium hidden sm:inline">
                  {pendingCount} pending
                </span>
              {/if}
            </div>

            {#if pendingCount > 0 && !collapsed}
              <button onclick={() => approveAllInGroup(group.applications)}
                class="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition shrink-0">
                <CheckCircle size={12}/> Approve All
              </button>
            {/if}
          </div>

          <!-- Group Body -->
          {#if !collapsed}

            <!-- Desktop Table -->
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-sm" style="table-layout: fixed;">
                <colgroup>
                  <col style="width: 32px;" />
                  <col style="width: 14%;" />
                  <col style="width: 17%;" />
                  <col style="width: 5%;" />
                  <col style="width: 11%;" />
                  <col style="width: 10%;" />
                  <col style="width: 8%;" />
                  <col style="width: auto;" />
                </colgroup>
                <thead>
                  <tr class="text-left text-gray-400 text-xs uppercase tracking-wide bg-gray-50/50">
                    <th class="px-2 py-2.5"></th>
                    <th class="px-2 py-2.5 font-medium">Name</th>
                    <th class="px-2 py-2.5 font-medium">Address</th>
                    <th class="px-2 py-2.5 font-medium">Age</th>
                    <th class="px-2 py-2.5 font-medium">Contact</th>
                    <th class="px-2 py-2.5 font-medium">Date Applied</th>
                    <th class="px-2 py-2.5 font-medium">Status</th>
                    <th class="px-2 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  {#each group.applications as app}
                    <tr class="hover:bg-gray-50/60 {selected.has(app.id) ? 'bg-blue-50/40' : ''}">
                      <td class="px-2 py-3">
                        <button onclick={() => toggleSelect(app.id)} class="text-gray-400 hover:text-gray-600">
                          {#if selected.has(app.id)}
                            <CheckSquare size={15} class="text-blue-600"/>
                          {:else}
                            <Square size={15}/>
                          {/if}
                        </button>
                      </td>
                      <td class="px-4 py-3 font-medium text-gray-900 truncate">{app.full_name}</td>
                      <td class="px-4 py-3 text-gray-600 truncate">{app.address}</td>
                      <td class="px-4 py-3 text-gray-700">{app.age}</td>
                      <td class="px-4 py-3 text-gray-600 truncate">{app.contact}</td>
                      <td class="px-4 py-3 text-gray-500 text-xs">{fmtDate(app.created_at)}</td>
                      <td class="px-4 py-3">
                        <div class="flex flex-col gap-0.5">
                          <span class={statusClass[app.status]??'badge-pending'}>{app.status}</span>
                          {#if app.status === 'rejected' && app.notes}
                            <span class="text-[10px] text-red-400 truncate max-w-22.5" title={app.notes}>"{app.notes}"</span>
                          {/if}
                        </div>
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex gap-1.5 items-center flex-wrap">
                          <!-- View Full Application -->
                          <button
                            class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                            style="background:#f8fafc;color:#475569;border:1px solid #e2e8f0;"
                            onclick={() => openAppModal(app)}>
                            <Eye size={12}/> View
                          </button>

                          <!-- Requirements -->
                          <button
                            class="relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                            style="background:#f0f7ff;color:#0A1F44;border:1px solid #bfdbfe;"
                            onclick={() => openRequirements(app)}>
                            <FileScan size={12}/> Files
                            {#if app.file_count && app.file_count > 0}
                              <span class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white" style="background:#0A1F44;">
                                {app.file_count}
                              </span>
                            {/if}
                          </button>

                          {#if app.status === 'pending' || app.status === 'waitlist'}
                            <button class="btn-success flex items-center gap-1" onclick={() => updateStatus(app.id,'approved')}>
                              <ThumbsUp size={12}/> Approve
                            </button>
                            <button class="btn-warning flex items-center gap-1" onclick={() => updateStatus(app.id,'waitlist')}>
                              <Clock size={12}/> Waitlist
                            </button>
                            <button class="btn-danger flex items-center gap-1" onclick={() => updateStatus(app.id,'rejected', app.full_name)}>
                              <Ban size={12}/> Reject
                            </button>

                          {:else if app.status === 'approved' && !app.beneficiary_id}
                            <button
                              class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
                              style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;"
                              onclick={() => markReceived(app.id, app.full_name)}>
                              Mark as Received
                            </button>

                          {:else if app.status === 'approved' && app.beneficiary_id}
                            <span class="text-emerald-600 text-xs font-medium">Received</span>

                          {:else}
                            <span class="text-gray-400 text-xs">Processed</span>
                          {/if}
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- Mobile Cards -->
            <div class="md:hidden divide-y divide-gray-100">
              {#each group.applications as app}
                <div class="p-4 {selected.has(app.id) ? 'bg-blue-50/40' : ''}">
                  <div class="flex items-start gap-3">
                    <button onclick={() => toggleSelect(app.id)} class="mt-0.5 text-gray-400 hover:text-gray-600 shrink-0">
                      {#if selected.has(app.id)}
                        <CheckSquare size={15} class="text-blue-600"/>
                      {:else}
                        <Square size={15}/>
                      {/if}
                    </button>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-2 mb-2">
                        <span class="font-semibold text-sm text-gray-900 leading-tight">{app.full_name}</span>
                        <div class="flex flex-col items-end gap-0.5 shrink-0">
                          <span class="{statusClass[app.status]??'badge-pending'}">{app.status}</span>
                          {#if app.status === 'rejected' && app.notes}
                            <span class="text-[10px] text-red-400 text-right max-w-30 truncate">"{app.notes}"</span>
                          {/if}
                        </div>
                      </div>
                      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs mb-3">
                        <dt class="text-gray-400 font-medium whitespace-nowrap">Address</dt>
                        <dd class="text-gray-700 truncate">{app.address}</dd>
                        <dt class="text-gray-400 font-medium whitespace-nowrap">Age</dt>
                        <dd class="text-gray-700">{app.age}</dd>
                        <dt class="text-gray-400 font-medium whitespace-nowrap">Contact</dt>
                        <dd class="text-gray-700">{app.contact}</dd>
                        <dt class="text-gray-400 font-medium whitespace-nowrap">Date Applied</dt>
                        <dd class="text-gray-700">{fmtDate(app.created_at)}</dd>
                      </dl>
                      <div class="flex gap-1.5 flex-wrap">
                        <button
                          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                          style="background:#f8fafc;color:#475569;border:1px solid #e2e8f0;"
                          onclick={() => openAppModal(app)}>
                          <Eye size={11}/> View
                        </button>
                        <button
                          class="relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                          style="background:#f0f7ff;color:#0A1F44;border:1px solid #bfdbfe;"
                          onclick={() => openRequirements(app)}>
                          <FileScan size={11}/> Files
                          {#if app.file_count && app.file_count > 0}
                            <span class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white" style="background:#0A1F44;">
                              {app.file_count}
                            </span>
                          {/if}
                        </button>

                        {#if app.status === 'pending' || app.status === 'waitlist'}
                          <button class="btn-success flex items-center gap-1" onclick={() => updateStatus(app.id,'approved')}>
                            <ThumbsUp size={11}/> Approve
                          </button>
                          <button class="btn-warning flex items-center gap-1" onclick={() => updateStatus(app.id,'waitlist')}>
                            <Clock size={11}/> Waitlist
                          </button>
                          <button class="btn-danger flex items-center gap-1" onclick={() => updateStatus(app.id,'rejected', app.full_name)}>
                            <Ban size={11}/> Reject
                          </button>

                        {:else if app.status === 'approved' && !app.beneficiary_id}
                          <button
                            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
                            style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;"
                            onclick={() => markReceived(app.id, app.full_name)}>
                            Mark as Received
                          </button>

                        {:else if app.status === 'approved' && app.beneficiary_id}
                          <span class="text-emerald-600 text-xs font-medium">Received</span>

                        {:else}
                          <span class="text-gray-400 text-xs">Processed</span>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}

              {#if pendingCount > 0}
                <div class="px-4 py-3 bg-slate-50/50 border-t border-slate-100">
                  <button onclick={() => approveAllInGroup(group.applications)}
                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition w-full justify-center">
                    <CheckCircle size={13}/> Approve All Pending in this Program
                  </button>
                </div>
              {/if}
            </div>

          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>