<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { apiFetch } from '$lib/api';
  import PenLine from 'lucide-svelte/icons/pen-line';
  import X from 'lucide-svelte/icons/x';
  import UserCheck from 'lucide-svelte/icons/user-check';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';
  import Search from 'lucide-svelte/icons/search';
  import Users from 'lucide-svelte/icons/users';
  import History from 'lucide-svelte/icons/history';
  import List from 'lucide-svelte/icons/list';
  import Phone from 'lucide-svelte/icons/phone';
  import MapPin from 'lucide-svelte/icons/map-pin';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import FileDown from 'lucide-svelte/icons/file-down';
  import * as XLSX from 'xlsx';

  interface Beneficiary {
    id: string | number;
    full_name: string;
    address: string;
    contact: string;
    program_id: string | number;
    program_title: string;
    category: string;
    received_at: string;
    age?: number;
    barangay?: string;
    notes?: string;
  }
  interface Program { id: string | number; title: string; }
  interface BenefitRecord {
    id: string | number;
    program_title: string;
    category: string;
    status: string;
    created_at: string;
    received_at?: string;
  }
  interface SearchResult {
    full_name: string;
    address: string;
    records: BenefitRecord[];
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

  let activeTab = $state<'list' | 'search'>('list');

  let beneficiaries  = $state<Beneficiary[]>([]);
  let programs       = $state<Program[]>([]);
  let filterProgram  = $state('');
  let search         = $state('');
  let loading        = $state(true);

  // ── Search / History ──
  let searchQuery   = $state('');
  let searchResults = $state<SearchResult[]>([]);
  let searchLoading = $state(false);
  let searchError   = $state('');
  let searchDone    = $state(false);
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // ── Profile Modal ──
  let showProfile    = $state(false);
  let profileData    = $state<ProfileDetail | null>(null);
  let profileLoading = $state(false);
  let dialogEl       = $state<HTMLDialogElement | undefined>(undefined);

  // ── Manual Encode ──
  let showManualForm = $state(false);
  let manualForm     = $state({ full_name:'', address:'', age:'', contact:'', barangay:'', notes:'', program_id:'' });
  let manualLoading  = $state(false);
  let manualError    = $state('');
  let manualSuccess  = $state('');
  let manualWarning  = $state('');

  onMount(async () => {
    [beneficiaries, programs] = await Promise.all([
      apiFetch('/beneficiaries'),
      apiFetch('/programs')
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

  // ── Profile Modal ──────────────────────────────────────────────────────
  async function openProfile(b: Beneficiary) {
    showProfile = true;
    profileLoading = true;
    profileData = null;
    dialogEl?.showModal();
    try {
      profileData = await apiFetch(`/beneficiaries/${b.id}/profile`);
    } catch {
      profileData = { full_name: b.full_name, address: b.address, contact: b.contact, age: b.age, barangay: b.barangay, notes: b.notes, records: [] };
    } finally {
      profileLoading = false;
    }
  }

  function closeProfile() {
    dialogEl?.close();
    showProfile = false;
    profileData = null;
  }

  function handleDialogKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeProfile();
  }

  // ── Export per program ─────────────────────────────────────────────────
  function exportProgram(programTitle: string, items: Beneficiary[]) {
    const rows = items.map((b, i) => ({
      '#': i + 1,
      'Full Name': b.full_name,
      'Address':   b.address,
      'Contact':   b.contact,
      'Barangay':  b.barangay || '',
      'Age':       b.age || '',
      'Received At': b.received_at ? new Date(b.received_at).toLocaleDateString('en-PH') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries');
    XLSX.writeFile(wb, `Beneficiaries_${programTitle.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  }

  // ── Search / History — real-time with debounce ────────────────────────
  async function runSearch() {
    const q = searchQuery.trim();
    if (!q) {
      searchResults = [];
      searchDone = false;
      searchError = '';
      return;
    }
    searchLoading = true;
    searchError = '';
    try {
      searchResults = await apiFetch(`/beneficiaries/search?q=${encodeURIComponent(q)}`);
      searchDone = true;
    } catch (e) {
      searchError = e instanceof Error ? e.message : 'Search failed';
    } finally {
      searchLoading = false;
    }
  }

  // Called on every keystroke — debounced 300 ms
  function handleSearchInput() {
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!searchQuery.trim()) {
      searchResults = [];
      searchDone = false;
      searchError = '';
      searchLoading = false;
      return;
    }
    searchLoading = true; // show spinner immediately
    searchDebounce = setTimeout(runSearch, 300);
  }

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

  // ── Manual Encode ──────────────────────────────────────────────────────
  async function submitManual() {
    if (!manualForm.program_id || !manualForm.full_name || !manualForm.address || !manualForm.contact) {
      manualError = 'Please fill in all required fields (*)'; return;
    }
    manualLoading = true; manualError = ''; manualSuccess = ''; manualWarning = '';
    try {
      const res = await apiFetch('/beneficiaries/manual', {
        method: 'POST',
        body: { program_id: manualForm.program_id, full_name: manualForm.full_name, address: manualForm.address, age: parseInt(manualForm.age) || 0, contact: manualForm.contact, barangay: manualForm.barangay, notes: manualForm.notes }
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

  // ── Derived list ──
  let filtered = $derived(
    beneficiaries.filter(b => {
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

<!-- ── Profile Modal ───────────────────────────────────────────────────────── -->
<dialog
  bind:this={dialogEl}
  onkeydown={handleDialogKeydown}
  class="p-0 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] backdrop:bg-black/40 open:flex open:flex-col"
  style="border:none;"
>
  {#if showProfile}
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
      <h2 class="font-bold text-gray-900 text-lg">Beneficiary Profile</h2>
      <button onclick={closeProfile} class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
        <X size={18} />
      </button>
    </div>

    <div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">
      {#if profileLoading}
        <div class="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
          <div class="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin" style="border-top-color:#0A1F44;"></div>
          Loading profile...
        </div>
      {:else if profileData}
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-[#0A1F44] flex items-center justify-center text-white text-xl font-bold shrink-0">
            {profileData.full_name.charAt(0)}
          </div>
          <div>
            <div class="text-xl font-bold text-gray-900">{profileData.full_name}</div>
            {#if profileData.barangay}
              <div class="text-sm text-gray-400">{profileData.barangay}</div>
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
          {#if profileData.age}
            <div class="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <UserCheck size={15} class="shrink-0 text-gray-400" />
              <div>
                <div class="text-xs text-gray-400 font-medium mb-0.5">Age</div>
                <div class="text-sm text-gray-800">{profileData.age} years old</div>
              </div>
            </div>
          {/if}
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
  {/if}
</dialog>

<div class="space-y-5 p-4 sm:p-6">

  <!-- Page Header -->
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Beneficiaries</h1>
      <p class="text-sm text-gray-500">Complete list of approved recipients and benefit history</p>
    </div>
    {#if activeTab === 'list'}
      <button class="btn-primary flex items-center gap-1.5" onclick={() => { showManualForm = true; }}>
        <PenLine size={15} /> Manual Encode
      </button>
    {/if}
  </div>

  <!-- Tab Switcher -->
  <div class="flex border-b border-gray-200">
    <button
      onclick={() => { activeTab = 'list'; }}
      class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
             {activeTab === 'list' ? 'border-[#0A1F44] text-[#0A1F44]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
    >
      <List size={15} /> List view
    </button>
    <button
      onclick={() => { activeTab = 'search'; }}
      class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
             {activeTab === 'search' ? 'border-[#0A1F44] text-[#0A1F44]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
    >
      <History size={15} /> Search / History
    </button>
  </div>

  <!-- ══════════════════════════════ LIST TAB ══════════════════════════════ -->
  {#if activeTab === 'list'}

    {#if showManualForm}
      <div class="card border-2 border-blue-200 bg-blue-50/30">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="flex items-center gap-2 font-bold text-gray-900">
            <PenLine size={16} class="text-[#0A1F44]" /> Manual Beneficiary Entry
          </h2>
          <button onclick={() => { showManualForm = false; manualError = ''; manualSuccess = ''; manualWarning = ''; }} class="text-gray-400 transition hover:text-gray-600">
            <X size={18} />
          </button>
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
            <input id="mcontact" bind:value={manualForm.contact} class="input" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="11" oninput={(e) => {
              const target = e.target as HTMLInputElement;
              manualForm.contact = target.value.replace(/[^0-9]/g, '').slice(0, 11);
            }} />
          </div>
          <div>
            <label class="label" for="mage">Age</label>
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
        <!-- Real-time filter: bind:value na directly reactive via $derived -->
        <div class="relative">
          <Search size={15} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="fs"
            bind:value={search}
            class="input pl-8"
            placeholder="Search by name..."
          />
        </div>
      </div>
    </div>

    {#if loading}
      <div class="text-sm text-gray-400">Loading beneficiaries...</div>
    {:else}
      <div class="text-sm font-medium text-gray-500">
        {filtered.length} beneficiar{filtered.length === 1 ? 'y' : 'ies'} total
      </div>

      {#if Object.keys(grouped).length === 0}
        <div class="card flex flex-col items-center gap-2 py-12 text-center text-gray-400">
          <Users size={32} class="text-gray-300" />
          {search ? `No results for "${search}"` : 'No beneficiaries found'}
        </div>
      {:else}
        {#each Object.entries(grouped) as [programTitle, group]}
          <div class="card">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A1F44]/10 text-sm font-bold text-[#0A1F44]">
                  {group.items.length}
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900">{programTitle}</h3>
                  <span class="text-xs text-gray-500">{group.category}</span>
                </div>
              </div>
              <button
                onclick={() => exportProgram(programTitle, group.items)}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition"
              >
                <FileDown size={13} /> Export
              </button>
            </div>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {#each group.items as b}
                <button
                  type="button"
                  onclick={() => openProfile(b)}
                  class="flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-left hover:bg-blue-50 hover:shadow-sm transition-all duration-150 group w-full"
                >
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A1F44] text-xs font-bold text-white mt-0.5">
                    {b.full_name.charAt(0)}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-1">
                      <div class="truncate text-sm font-semibold text-gray-900">{b.full_name}</div>
                      <ChevronRight size={13} class="shrink-0 text-gray-300 group-hover:text-[#0A1F44] transition-colors" />
                    </div>
                    {#if b.address}
                      <div class="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} class="shrink-0 text-gray-400" />
                        <div class="truncate text-xs text-gray-400">{b.address}</div>
                      </div>
                    {/if}
                    {#if b.contact}
                      <div class="flex items-center gap-1 mt-0.5">
                        <Phone size={10} class="shrink-0 text-gray-400" />
                        <div class="truncate text-xs text-gray-400">{b.contact}</div>
                      </div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    {/if}

  <!-- ══════════════════════════ SEARCH / HISTORY TAB ══════════════════════ -->
  {:else}

    <div class="card">
      <p class="text-sm font-medium text-gray-700 mb-3">
        Search for a resident to view their complete benefit history
      </p>
      <!-- Real-time search input — oninput triggers debounced API call -->
      <div class="relative">
        {#if searchLoading}
          <!-- Spinner while waiting -->
          <div
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-gray-200"
            style="border-top-color: #0A1F44;"
          ></div>
        {:else}
          <Search size={15} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        {/if}
        <input
          bind:value={searchQuery}
          oninput={handleSearchInput}
          class="input pl-9 w-full"
          placeholder="Type a name to search…"
          autocomplete="off"
        />
        {#if searchQuery}
          <button
            onclick={() => { searchQuery = ''; searchResults = []; searchDone = false; searchError = ''; }}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition"
          >
            <X size={15} />
          </button>
        {/if}
      </div>
      {#if searchError}
        <p class="mt-2 text-sm text-red-600">{searchError}</p>
      {/if}
    </div>

    <!-- Results -->
    {#if !searchQuery.trim()}
      <!-- Idle state -->
      <div class="card text-center py-12 text-gray-400">
        <History size={32} class="mx-auto mb-2 text-gray-300" />
        <p class="text-sm">Type a name above to see their benefit history</p>
      </div>

    {:else if searchLoading}
      <!-- Loading skeleton -->
      <div class="card py-10 flex flex-col items-center gap-3 text-gray-400">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-200" style="border-top-color:#0A1F44;"></div>
        <p class="text-sm">Searching…</p>
      </div>

    {:else if searchDone && searchResults.length === 0}
      <div class="card text-center py-12 text-gray-400">
        <Search size={32} class="mx-auto mb-2 text-gray-300" />
        <p class="text-sm">No records found for "<strong class="text-gray-600">{searchQuery}</strong>"</p>
      </div>

    {:else if searchDone}
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
    {/if}

  {/if}
</div>