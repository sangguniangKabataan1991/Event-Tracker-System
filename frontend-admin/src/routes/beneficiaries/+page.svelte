<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { apiFetch } from '$lib/api';
  import * as XLSX from 'xlsx';

  import PenLine           from 'lucide-svelte/icons/pen-line';
  import Upload            from 'lucide-svelte/icons/upload';
  import Download          from 'lucide-svelte/icons/download';
  import X                 from 'lucide-svelte/icons/x';
  import UserCheck         from 'lucide-svelte/icons/user-check';
  import AlertTriangle     from 'lucide-svelte/icons/alert-triangle';
  import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';
  import Search            from 'lucide-svelte/icons/search';
  import Users             from 'lucide-svelte/icons/users';
  import MapPin            from 'lucide-svelte/icons/map-pin';
  import Phone             from 'lucide-svelte/icons/phone';
  import History           from 'lucide-svelte/icons/history';
  import List              from 'lucide-svelte/icons/list';
  import FileDown          from 'lucide-svelte/icons/file-down';
  import ChevronDown       from 'lucide-svelte/icons/chevron-down';
  import ChevronRight      from 'lucide-svelte/icons/chevron-right';
  import FileSpreadsheet   from 'lucide-svelte/icons/file-spreadsheet';
  import CheckCircle       from 'lucide-svelte/icons/check-circle';
  import Trash2            from 'lucide-svelte/icons/trash-2';

  interface Beneficiary {
    id: string | number;
    full_name: string;
    address: string;
    contact: string;
    age?: number;
    program_id: string | number;
    program_title: string;
    category: string;
    received_at: string;
    barangay?: string;
    notes?: string;
  }

  interface Program { id: string | number; title: string; }

  interface BenefitRecord {
    program_title: string;
    category: string;
    status: string;
    created_at: string;
  }

  interface ProfileDetail {
    full_name: string;
    address: string;
    contact: string;
    age?: number;
    barangay?: string;
    notes?: string;
    records: BenefitRecord[];
  }

  interface SearchResult {
    full_name: string;
    address: string;
    records: BenefitRecord[];
  }

  let beneficiaries   = $state<Beneficiary[]>([]);
  let programs        = $state<Program[]>([]);
  let filterProgram   = $state('');
  let search          = $state('');
  let loading         = $state(true);
  let activeTab       = $state<'list' | 'search'>('list');
  let collapsedGroups = $state<Set<string>>(new Set());

  // ── Live search ──────────────────────────────────────────────────────────
  let searchQuery   = $state('');
  let searchResults = $state<SearchResult[]>([]);
  let searchLoading = $state(false);
  let searchError   = $state('');
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // ── Profile modal ────────────────────────────────────────────────────────
  let showProfile    = $state(false);
  let profileData    = $state<ProfileDetail | null>(null);
  let profileLoading = $state(false);

  // ── Delete confirm ───────────────────────────────────────────────────────
  let showDeleteConfirm   = $state(false);
  let deleteTarget        = $state<Beneficiary | null>(null);
  let deleteLoading       = $state(false);
  let globalSuccess       = $state('');
  let globalError         = $state('');

  // ── Manual encode ────────────────────────────────────────────────────────
  let showManualForm = $state(false);
  let manualForm     = $state({ full_name:'', address:'', age:'', contact:'', barangay:'', notes:'', program_id:'' });
  let manualLoading  = $state(false);
  let manualError    = $state('');
  let manualSuccess  = $state('');
  let manualWarning  = $state('');

  // ── Excel import ─────────────────────────────────────────────────────────
  let showImportForm  = $state(false);
  let importProgramId = $state('');
  let importPreview   = $state<any[]>([]);
  let importLoading   = $state(false);
  let importError     = $state('');
  let importSuccess   = $state('');
  let importWarnings  = $state<string[]>([]);
  let importSkipped   = $state<string[]>([]);
  let fileInput       = $state<HTMLInputElement | undefined>(undefined);

  onMount(async () => {
    [beneficiaries, programs] = await Promise.all([
      apiFetch('/beneficiaries'),
      apiFetch('/programs'),
    ]);
    loading = false;
    const tabParam = page.url.searchParams.get('tab');
    const qParam   = page.url.searchParams.get('q') ?? '';
    if (tabParam === 'search') {
      activeTab = 'search';
      if (qParam) { searchQuery = qParam; await runSearch(); }
    }
  });

  async function reloadBeneficiaries() {
    beneficiaries = await apiFetch('/beneficiaries');
  }

  function toggleGroup(key: string) {
    const next = new Set(collapsedGroups);
    next.has(key) ? next.delete(key) : next.add(key);
    collapsedGroups = next;
  }

  // ── Profile ──────────────────────────────────────────────────────────────
  async function openProfile(b: Beneficiary) {
    showProfile = true; profileLoading = true; profileData = null;
    try {
      profileData = await apiFetch(`/beneficiaries/${b.id}/profile`);
    } catch {
      profileData = { full_name: b.full_name, address: b.address, contact: b.contact, age: b.age, barangay: b.barangay, notes: b.notes, records: [] };
    } finally {
      profileLoading = false;
    }
  }
  function closeProfile() { showProfile = false; profileData = null; }

  // ── Delete ───────────────────────────────────────────────────────────────
  function confirmDelete(b: Beneficiary) {
    deleteTarget      = b;
    showDeleteConfirm = true;
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    deleteLoading = true;
    try {
      await apiFetch(`/beneficiaries/${deleteTarget.id}`, { method: 'DELETE' });
      globalSuccess = `${deleteTarget.full_name} has been removed from beneficiaries.`;
      showDeleteConfirm = false;
      deleteTarget      = null;
      await reloadBeneficiaries();
      setTimeout(() => globalSuccess = '', 4000);
    } catch (e) {
      globalError = e instanceof Error ? e.message : 'Failed to delete beneficiary';
      showDeleteConfirm = false;
      setTimeout(() => globalError = '', 4000);
    } finally {
      deleteLoading = false;
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────
  function exportProgram(programTitle: string, items: Beneficiary[]) {
    const rows = items.map((b, i) => ({
      '#':           i + 1,
      'Full Name':   b.full_name,
      'Address':     b.address,
      'Age':         b.age || '—',
      'Contact':     b.contact,
      'Received At': b.received_at ? new Date(b.received_at).toLocaleDateString('en-PH') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries');
    XLSX.writeFile(wb, `Beneficiaries_${programTitle.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  }

  // ── Live search (debounced) ───────────────────────────────────────────────
  function onSearchInput() {
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!searchQuery.trim()) { searchResults = []; searchError = ''; return; }
    searchDebounce = setTimeout(() => runSearch(), 350);
  }

  async function runSearch() {
    if (!searchQuery.trim()) return;
    searchLoading = true; searchError = '';
    try {
      searchResults = await apiFetch(`/beneficiaries/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } catch (e) {
      searchError = e instanceof Error ? e.message : 'Search failed';
    } finally {
      searchLoading = false;
    }
  }

  // ── Manual encode ─────────────────────────────────────────────────────────
  async function submitManual() {
    if (!manualForm.program_id || !manualForm.full_name || !manualForm.address || !manualForm.contact) {
      manualError = 'Please fill in all required fields (*)'; return;
    }
    manualLoading = true; manualError = ''; manualSuccess = ''; manualWarning = '';
    try {
      const res = await apiFetch('/beneficiaries/manual', {
        method: 'POST',
        body: {
          program_id: manualForm.program_id,
          full_name:  manualForm.full_name,
          address:    manualForm.address,
          age:        parseInt(manualForm.age) || 0,
          contact:    manualForm.contact,
          barangay:   manualForm.barangay,
          notes:      manualForm.notes,
        },
      });
      manualSuccess = res.message;
      if (res.warning) manualWarning = res.warning;
      manualForm = { full_name:'', address:'', age:'', contact:'', barangay:'', notes:'', program_id: manualForm.program_id };
      await reloadBeneficiaries();
    } catch (e) {
      manualError = e instanceof Error ? e.message : 'An error occurred';
    } finally {
      manualLoading = false;
    }
  }

  // ── Excel import ──────────────────────────────────────────────────────────
  function downloadTemplate() {
    const template = [
      { 'Full Name': 'Juan Dela Cruz', Address: 'Blk 1 Lot 2, Sample St., Sto. Nino', Age: 18, Contact: '09123456789' },
      { 'Full Name': 'Maria Santos',   Address: 'Blk 3 Lot 4, Sample St., Sto. Nino', Age: 20, Contact: '09987654321' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries');
    XLSX.writeFile(wb, 'SK_Beneficiary_Template.xlsx');
  }

  function handleFileUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    importError = ''; importPreview = [];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet) as any[];
        if (rows.length === 0) { importError = 'The uploaded file contains no data.'; return; }
        importPreview = rows
          .map((row) => ({
            full_name: row['Full Name'] || row['full_name'] || row['Name'] || row['name'] || '',
            address:   row['Address']   || row['address']   || '',
            age:       row['Age']       || row['age']       || '',
            contact:   row['Contact']   || row['contact']   || row['Contact Number'] || '',
          }))
          .filter((r) => r.full_name);
        if (importPreview.length === 0) {
          importError = 'No valid records found. Make sure columns are: "Full Name", "Address", "Age", "Contact".';
        }
      } catch {
        importError = 'Could not read file. Please upload a valid .xlsx or .xls file.';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function submitImport() {
    if (!importProgramId) { importError = 'Please select a program'; return; }
    if (importPreview.length === 0) { importError = 'No data to import'; return; }
    importLoading = true; importError = ''; importSuccess = ''; importWarnings = []; importSkipped = [];
    try {
      const res = await apiFetch('/beneficiaries/bulk-import', {
        method: 'POST',
        body: { program_id: importProgramId, beneficiaries: importPreview },
      });
      importSuccess  = res.message;
      importWarnings = res.warnings     || [];
      importSkipped  = res.skippedNames || [];
      importPreview  = [];
      if (fileInput) fileInput.value = '';
      await reloadBeneficiaries();
    } catch (e) {
      importError = e instanceof Error ? e.message : 'Import failed';
    } finally {
      importLoading = false;
    }
  }

  function closeImport() {
    showImportForm = false; importPreview = []; importError = '';
    importSuccess = ''; importWarnings = []; importSkipped = [];
    if (fileInput) fileInput.value = '';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function statusBadgeClass(status: string) {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    if (status === 'pending')  return 'bg-amber-100 text-amber-700';
    if (status === 'waitlist') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-500';
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  let filtered = $derived(
    beneficiaries.filter((b) => {
      const matchProgram = !filterProgram || b.program_id == filterProgram;
      const matchSearch  = !search || b.full_name.toLowerCase().includes(search.toLowerCase());
      return matchProgram && matchSearch;
    })
  );

  let grouped = $derived(
    filtered.reduce<Record<string, { category: string; items: Beneficiary[] }>>((acc, b) => {
      const key = b.program_title || 'Unknown';
      if (!acc[key]) acc[key] = { category: b.category, items: [] };
      acc[key].items.push(b);
      return acc;
    }, {})
  );
</script>

<!-- ══ DELETE CONFIRMATION MODAL ═════════════════════════════════════════════ -->
{#if showDeleteConfirm && deleteTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
    style="background: rgba(10,31,68,0.5); backdrop-filter: blur(2px);">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
      <div class="px-5 pt-6 pb-4 text-center">
        <div class="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} class="text-red-500" />
        </div>
        <h2 class="text-base font-bold text-slate-900">Remove Beneficiary?</h2>
        <p class="text-sm text-slate-500 mt-1.5">
          You are about to remove
          <span class="font-semibold text-slate-700">{deleteTarget.full_name}</span>
          from the beneficiaries list. This action cannot be undone.
        </p>
      </div>
      <div class="flex gap-2 px-5 pb-6">
        <button onclick={executeDelete} disabled={deleteLoading}
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition">
          {deleteLoading ? 'Removing...' : 'Yes, Remove'}
        </button>
        <button onclick={() => { showDeleteConfirm = false; deleteTarget = null; }}
          class="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ══ PROFILE MODAL ══════════════════════════════════════════════════════════ -->
{#if showProfile}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
    style="background: rgba(0,0,0,0.45); backdrop-filter: blur(3px);"
    role="button" tabindex="-1"
    onclick={closeProfile}
    onkeydown={(e) => e.key === 'Escape' && closeProfile()}>
    <div role="dialog" aria-modal="true" tabindex="-1"
      class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
      style="max-height: 88vh;"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}>

      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <h2 class="font-bold text-gray-900 text-base">Beneficiary Profile</h2>
        <button onclick={closeProfile} class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
          <X size={18} />
        </button>
      </div>

      <div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">
        {#if profileLoading}
          <div class="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
            <div class="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin" style="border-top-color:#0A1F44;"></div>
            Loading profile...
          </div>
        {:else if profileData}
          <div class="flex flex-col items-center text-center gap-2 pt-2 pb-1">
            <div class="w-16 h-16 rounded-full bg-[#0A1F44] flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {profileData.full_name.charAt(0)}
            </div>
            <div>
              <div class="text-lg font-bold text-gray-900">{profileData.full_name}</div>
              {#if profileData.age}
                <div class="text-sm text-gray-400 mt-0.5">{profileData.age} years old</div>
              {/if}
              {#if profileData.barangay}
                <div class="text-sm text-gray-400 mt-0.5">{profileData.barangay}</div>
              {/if}
            </div>
          </div>

          <div class="grid grid-cols-1 gap-2.5">
            <div class="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <MapPin size={15} class="mt-0.5 shrink-0 text-gray-400" />
              <div>
                <div class="text-xs text-gray-400 font-medium mb-0.5">Address</div>
                <div class="text-sm text-gray-800">{profileData.address}</div>
              </div>
            </div>
            <div class="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <Phone size={15} class="shrink-0 text-gray-400" />
              <div>
                <div class="text-xs text-gray-400 font-medium mb-0.5">Contact</div>
                <div class="text-sm text-gray-800">{profileData.contact || '—'}</div>
              </div>
            </div>
            {#if profileData.notes}
              <div class="flex items-start gap-3 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
                <AlertTriangle size={15} class="mt-0.5 shrink-0 text-yellow-500" />
                <div>
                  <div class="text-xs text-yellow-600 font-medium mb-0.5">Notes</div>
                  <div class="text-sm text-gray-800">{profileData.notes}</div>
                </div>
              </div>
            {/if}
          </div>

          <div>
            <h3 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <History size={15} class="text-gray-400" />
              Benefit History
              <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0A1F44]/10 text-[#0A1F44]">
                {profileData.records.length} record{profileData.records.length !== 1 ? 's' : ''}
              </span>
            </h3>
            {#if profileData.records.length === 0}
              <div class="text-center py-6 text-gray-400">
                <History size={24} class="mx-auto mb-1 text-gray-300" />
                <p class="text-sm">No benefit records yet</p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each profileData.records as rec}
                  <div class="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 gap-3">
                    <div class="min-w-0">
                      <div class="text-sm font-medium truncate">{rec.program_title}</div>
                      <div class="text-xs text-gray-400">{rec.category} · {fmtDate(rec.created_at)}</div>
                    </div>
                    <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 {statusBadgeClass(rec.status)}">
                      {rec.status}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ══ MAIN PAGE ══════════════════════════════════════════════════════════════ -->
<div class="space-y-5 p-4 sm:p-6">

  <!-- Header -->
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Beneficiaries</h1>
      <p class="text-sm text-gray-500">Complete list of approved recipients and benefit history</p>
    </div>
    {#if activeTab === 'list'}
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition"
          onclick={() => { showImportForm = !showImportForm; showManualForm = false; }}>
          <Upload size={15} /> Import Excel
        </button>
        <button
          class="btn-primary flex items-center gap-1.5"
          onclick={() => { showManualForm = !showManualForm; showImportForm = false; }}>
          <PenLine size={15} /> Manual Encode
        </button>
      </div>
    {/if}
  </div>

  <!-- Global alerts -->
  {#if globalSuccess}
    <div class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">{globalSuccess}</div>
  {/if}
  {#if globalError}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{globalError}</div>
  {/if}

  <!-- Tabs -->
  <div class="flex border-b border-gray-200">
    <button onclick={() => { activeTab = 'list'; }}
      class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
             {activeTab === 'list' ? 'border-[#0A1F44] text-[#0A1F44]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
      <List size={15} /> List view
    </button>
    <button onclick={() => { activeTab = 'search'; }}
      class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
             {activeTab === 'search' ? 'border-[#0A1F44] text-[#0A1F44]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
      <History size={15} /> Search / History
    </button>
  </div>

  {#if activeTab === 'list'}

    <!-- ── EXCEL IMPORT FORM ──────────────────────────────────────────────── -->
    {#if showImportForm}
      <div class="card border-2 border-blue-200 bg-blue-50/30">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="flex items-center gap-2 font-bold text-gray-900">
            <FileSpreadsheet size={16} class="text-blue-600" /> Import from Excel
          </h2>
          <button onclick={closeImport} class="text-gray-400 hover:text-gray-600 transition"><X size={18} /></button>
        </div>

        {#if importSuccess}
          <div class="mb-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle size={15} class="mt-0.5 shrink-0" /> {importSuccess}
          </div>
        {/if}
        {#if importWarnings.length > 0}
          <div class="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <p class="font-semibold mb-1 flex items-center gap-1.5"><AlertTriangle size={14}/> Warnings ({importWarnings.length})</p>
            <ul class="list-disc list-inside space-y-0.5">
              {#each importWarnings as w}<li class="text-xs">{w}</li>{/each}
            </ul>
          </div>
        {/if}
        {#if importSkipped.length > 0}
          <div class="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p class="font-semibold mb-1">Skipped duplicates ({importSkipped.length}): {importSkipped.join(', ')}</p>
          </div>
        {/if}
        {#if importError}
          <div class="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <X size={15} class="mt-0.5 shrink-0" /> {importError}
          </div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="label" for="imp-prog">Program *</label>
            <select id="imp-prog" bind:value={importProgramId} class="input">
              <option value="">— Select a Program —</option>
              {#each programs as p}<option value={p.id}>{p.title}</option>{/each}
            </select>
          </div>
          <div>
            <label class="label" for="imp-file">Excel File (.xlsx / .xls) *</label>
            <input id="imp-file" type="file" accept=".xlsx,.xls"
              bind:this={fileInput}
              onchange={handleFileUpload}
              class="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-xl px-2 py-1.5 bg-slate-50 cursor-pointer" />
          </div>
        </div>

        <button onclick={downloadTemplate} class="mb-4 flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition">
          <Download size={13} /> Download template (.xlsx)
        </button>

        {#if importPreview.length > 0}
          <div class="mb-4">
            <p class="text-xs font-semibold text-gray-600 mb-2">
              Preview — {importPreview.length} record{importPreview.length !== 1 ? 's' : ''} found
            </p>
            <div class="overflow-x-auto rounded-xl border border-slate-200">
              <table class="w-full text-xs">
                <thead>
                  <tr class="bg-slate-50 text-left text-gray-400 uppercase tracking-wide">
                    <th class="px-3 py-2 font-medium">#</th>
                    <th class="px-3 py-2 font-medium">Full Name</th>
                    <th class="px-3 py-2 font-medium">Address</th>
                    <th class="px-3 py-2 font-medium">Age</th>
                    <th class="px-3 py-2 font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  {#each importPreview.slice(0, 10) as row, i}
                    <tr class="hover:bg-slate-50/60">
                      <td class="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td class="px-3 py-2 font-medium text-gray-800">{row.full_name}</td>
                      <td class="px-3 py-2 text-gray-500 max-w-40 truncate">{row.address}</td>
                      <td class="px-3 py-2 text-gray-500">{row.age || '—'}</td>
                      <td class="px-3 py-2 text-gray-500">{row.contact}</td>
                    </tr>
                  {/each}
                  {#if importPreview.length > 10}
                    <tr>
                      <td colspan="5" class="px-3 py-2 text-center text-gray-400 italic">
                        ...and {importPreview.length - 10} more
                      </td>
                    </tr>
                  {/if}
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        <div class="flex gap-3">
          <button class="btn-primary flex flex-1 items-center justify-center gap-2"
            onclick={submitImport}
            disabled={importLoading || importPreview.length === 0 || !importProgramId}>
            <Upload size={15} /> {importLoading ? 'Importing...' : `Import ${importPreview.length > 0 ? importPreview.length + ' records' : ''}`}
          </button>
          <button class="btn-ghost" onclick={closeImport}>Close</button>
        </div>
      </div>
    {/if}

    <!-- ── MANUAL ENCODE FORM ─────────────────────────────────────────────── -->
    {#if showManualForm}
      <div class="card border-2 border-blue-200 bg-blue-50/30">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="flex items-center gap-2 font-bold text-gray-900">
            <PenLine size={16} class="text-[#0A1F44]" /> Manual Beneficiary Entry
          </h2>
          <button onclick={() => { showManualForm = false; manualError = ''; manualSuccess = ''; manualWarning = ''; }}
            class="text-gray-400 hover:text-gray-600 transition"><X size={18} /></button>
        </div>

        {#if manualSuccess}
          <div class="mb-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <UserCheck size={15} class="mt-0.5 shrink-0" /> {manualSuccess}
          </div>
        {/if}
        {#if manualWarning}
          <div class="mb-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <AlertTriangle size={15} class="mt-0.5 shrink-0" /> {manualWarning}
          </div>
        {/if}
        {#if manualError}
          <div class="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <X size={15} class="mt-0.5 shrink-0" /> {manualError}
          </div>
        {/if}

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="label" for="mp">Program *</label>
            <select id="mp" bind:value={manualForm.program_id} class="input">
              <option value="">— Select a Program —</option>
              {#each programs as p}<option value={p.id}>{p.title}</option>{/each}
            </select>
          </div>
          <div>
            <label class="label" for="mfn">Full Name *</label>
            <input id="mfn" bind:value={manualForm.full_name} class="input" />
          </div>
          <div>
            <label class="label" for="mcontact">Contact Number *</label>
            <input id="mcontact" bind:value={manualForm.contact} class="input"
              type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="11"
              oninput={(e) => {
                const t = e.target as HTMLInputElement;
                manualForm.contact = t.value.replace(/[^0-9]/g, '').slice(0, 11);
              }} />
          </div>
          <div>
            <label class="label" for="mage">Age *</label>
            <input id="mage" bind:value={manualForm.age} type="number" class="input" min="1" max="30" />
          </div>
          <div>
            <label class="label" for="mbrgy">Barangay</label>
            <input id="mbrgy" bind:value={manualForm.barangay} class="input" />
          </div>
          <div class="md:col-span-2">
            <label class="label" for="maddr">Address *</label>
            <input id="maddr" bind:value={manualForm.address} class="input" />
          </div>
          <div class="md:col-span-2">
            <label class="label" for="mnotes">Notes (optional)</label>
            <input id="mnotes" bind:value={manualForm.notes} class="input" />
          </div>
        </div>

        <div class="mt-4 flex gap-3">
          <button class="btn-primary flex flex-1 items-center justify-center gap-2" onclick={submitManual} disabled={manualLoading}>
            <UserCheck size={15} /> {manualLoading ? 'Saving...' : 'Save Beneficiary'}
          </button>
          <button class="btn-ghost" onclick={() => { showManualForm = false; manualError = ''; manualSuccess = ''; }}>Close</button>
        </div>
      </div>
    {/if}

    <!-- Filters -->
    <div class="card flex flex-wrap gap-3">
      <div class="min-w-48 flex-1">
        <label class="label flex items-center gap-1.5" for="fp">
          <SlidersHorizontal size={13} class="text-gray-400" /> Filter by Program
        </label>
        <select id="fp" bind:value={filterProgram} class="input">
          <option value="">All Programs</option>
          {#each programs as p}<option value={p.id}>{p.title}</option>{/each}
        </select>
      </div>
      <div class="min-w-48 flex-1">
        <label class="label flex items-center gap-1.5" for="fs">
          <Search size={13} class="text-gray-400" /> Search
        </label>
        <input id="fs" bind:value={search} class="input" placeholder="Search by name..." />
      </div>
    </div>

    <!-- List -->
    {#if loading}
      <div class="flex items-center gap-2 text-gray-400 text-sm py-8">
        <div class="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        Loading beneficiaries...
      </div>
    {:else}
      <div class="text-sm text-gray-500 px-1">
        <strong class="text-gray-800">{filtered.length}</strong> beneficiar{filtered.length === 1 ? 'y' : 'ies'} total
      </div>

      {#if Object.keys(grouped).length === 0}
        <div class="bg-white border border-slate-200 rounded-2xl text-center py-16 shadow-sm">
          <Users size={36} class="mx-auto mb-3 text-slate-300" />
          <p class="text-slate-400 text-sm">No beneficiaries found</p>
        </div>
      {/if}

      <div class="space-y-3">
        {#each Object.entries(grouped) as [programTitle, group]}
          {@const collapsed = collapsedGroups.has(programTitle)}
          <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-slate-300 transition-all">

            <!-- Group Header -->
            <div class="flex items-center gap-2 sm:gap-3 px-4 py-3 bg-slate-50/70 border-b border-slate-100">
              <button onclick={() => toggleGroup(programTitle)} class="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span class="text-slate-400 shrink-0">
                  {#if collapsed}<ChevronRight size={15}/>{:else}<ChevronDown size={15}/>{/if}
                </span>
                <span class="font-semibold text-slate-800 text-sm truncate">{programTitle}</span>
                <span class="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 shrink-0 hidden sm:inline">
                  {group.category}
                </span>
              </button>
              <div class="flex items-center gap-2 shrink-0">
                <span class="flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-xs text-gray-500">
                  <Users size={11}/> {group.items.length}
                </span>
                <button onclick={() => exportProgram(programTitle, group.items)}
                  class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition">
                  <FileDown size={12}/> Export
                </button>
              </div>
            </div>

            {#if !collapsed}
              <!-- Desktop Table -->
              <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-sm" style="table-layout: fixed;">
                  <colgroup>
                    <col style="width: 22%;" />
                    <col style="width: 28%;" />
                    <col style="width: 10%;" />
                    <col style="width: 15%;" />
                    <col style="width: 15%;" />
                    <col style="width: 10%;" />
                  </colgroup>
                  <thead>
                    <tr class="text-left text-gray-400 text-xs uppercase tracking-wide bg-gray-50/50">
                      <th class="px-4 py-2.5 font-medium">Name</th>
                      <th class="px-4 py-2.5 font-medium">Address</th>
                      <th class="px-4 py-2.5 font-medium">Age</th>
                      <th class="px-4 py-2.5 font-medium">Contact</th>
                      <th class="px-4 py-2.5 font-medium">Received</th>
                      <th class="px-4 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    {#each group.items as b}
                      <tr class="hover:bg-blue-50/40 transition-colors">
                        <td class="px-4 py-3 cursor-pointer" onclick={() => openProfile(b)}>
                          <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-7 h-7 rounded-full bg-[#0A1F44] flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {b.full_name.charAt(0)}
                            </div>
                            <span class="font-medium text-gray-900 truncate">{b.full_name}</span>
                          </div>
                        </td>
                        <td class="px-4 py-3 text-gray-500 truncate cursor-pointer" onclick={() => openProfile(b)}>{b.address}</td>
                        <td class="px-4 py-3 text-gray-600 cursor-pointer" onclick={() => openProfile(b)}>{b.age || '—'}</td>
                        <td class="px-4 py-3 text-gray-600 truncate cursor-pointer" onclick={() => openProfile(b)}>{b.contact || '—'}</td>
                        <td class="px-4 py-3 text-gray-500 text-xs cursor-pointer" onclick={() => openProfile(b)}>{b.received_at ? fmtDate(b.received_at) : '—'}</td>
                        <td class="px-4 py-3">
                          <button onclick={() => confirmDelete(b)}
                            class="flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Remove beneficiary">
                            <Trash2 size={13}/>
                          </button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>

              <!-- Mobile Cards -->
              <div class="md:hidden divide-y divide-gray-100">
                {#each group.items as b}
                  <div class="flex items-center gap-3 px-4 py-3 hover:bg-blue-50/40 transition-colors">
                    <button type="button" onclick={() => openProfile(b)}
                      class="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div class="w-8 h-8 rounded-full bg-[#0A1F44] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {b.full_name.charAt(0)}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm text-gray-900 truncate">{b.full_name}</div>
                        <div class="text-xs text-gray-400 truncate">{b.address}</div>
                        <div class="text-xs text-gray-400 mt-0.5">Age: {b.age || '—'} · {b.contact || '—'}</div>
                      </div>
                      <ChevronRight size={14} class="text-gray-300 shrink-0" />
                    </button>
                    <button onclick={() => confirmDelete(b)}
                      class="flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
                      title="Remove">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                {/each}
              </div>
            {/if}

          </div>
        {/each}
      </div>
    {/if}

  {:else}

    <!-- ══ SEARCH / HISTORY TAB ════════════════════════════════════════════ -->
    <div class="card">
      <p class="text-sm font-medium text-gray-700 mb-3">Search for a resident to view their complete benefit history</p>
      <div class="relative">
        <Search size={15} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input bind:value={searchQuery} oninput={onSearchInput} class="input pl-8 w-full" />
        {#if searchLoading}
          <div class="absolute right-3 top-1/2 -translate-y-1/2">
            <div class="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin" style="border-top-color:#0A1F44;"></div>
          </div>
        {/if}
      </div>
      {#if searchError}
        <p class="mt-2 text-sm text-red-600">{searchError}</p>
      {/if}
    </div>

    {#if searchQuery.trim() && !searchLoading && searchResults.length === 0}
      <div class="card text-center py-12 text-gray-400">
        <Search size={32} class="mx-auto mb-2 text-gray-300" />
        <p class="text-sm">No records found for "{searchQuery}"</p>
      </div>
    {:else if searchResults.length > 0}
      {#each searchResults as result}
        <div class="card">
          <div class="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
            <div class="w-10 h-10 rounded-full bg-[#0A1F44] flex items-center justify-center text-white font-bold text-sm shrink-0">
              {result.full_name.charAt(0)}
            </div>
            <div>
              <div class="font-semibold text-gray-900">{result.full_name}</div>
              <div class="text-xs text-gray-400">{result.address}</div>
            </div>
            <span class="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-[#0A1F44]/10 text-[#0A1F44]">
              {result.records.length} record{result.records.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div class="space-y-2">
            {#each result.records as rec}
              <div class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">{rec.program_title}</div>
                  <div class="text-xs text-gray-400">{rec.category} · {fmtDate(rec.created_at)}</div>
                </div>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 {statusBadgeClass(rec.status)}">
                  {rec.status}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {:else if !searchQuery.trim()}
      <div class="card text-center py-12 text-gray-400">
        <History size={32} class="mx-auto mb-2 text-gray-300" />
        <p class="text-sm">Start typing a name to see benefit history</p>
      </div>
    {/if}

  {/if}
</div>