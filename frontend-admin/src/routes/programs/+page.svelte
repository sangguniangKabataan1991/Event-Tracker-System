<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { apiFetch } from '$lib/api.js';
  import Plus from 'lucide-svelte/icons/plus';
  import Pencil from 'lucide-svelte/icons/pencil';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Users from 'lucide-svelte/icons/users';
  import X from 'lucide-svelte/icons/x';
  import CalendarDays from 'lucide-svelte/icons/calendar-days';
  import Tag from 'lucide-svelte/icons/tag';
  import ListChecks from 'lucide-svelte/icons/list-checks';
  import AlignLeft from 'lucide-svelte/icons/align-left';
  import Hash from 'lucide-svelte/icons/hash';
  import ToggleLeft from 'lucide-svelte/icons/toggle-left';
  import ToggleRight from 'lucide-svelte/icons/toggle-right';
  import ClipboardList from 'lucide-svelte/icons/clipboard-list';
  import FolderOpen from 'lucide-svelte/icons/folder-open';
  import Search from 'lucide-svelte/icons/search';
  import ArrowUpDown from 'lucide-svelte/icons/arrow-up-down';
  import Filter from 'lucide-svelte/icons/filter';

  type ProgramStatus = 'open' | 'closed' | 'draft' | 'completed';

  interface Program {
    id: string | number;
    title: string;
    description: string | null;
    category: string;
    slots: number;
    slots_used: number;
    pending_count: number;
    approved_count: number;
    status: ProgramStatus;
    requirements: string;
    start_date: string;
    end_date: string;
  }
  interface Category { name: string; }
  interface FormData {
    title: string; description: string; category: string;
    slots: string; requirements: string; start_date: string; end_date: string;
  }

  let programs        = $state<Program[]>([]);
  let categories      = $state<Category[]>([]);
  let loading         = $state(true);
  let showForm        = $state(false);
  let editMode        = $state(false);
  let selectedProgram = $state<Program | null>(null);
  let error           = $state('');
  let success         = $state('');

  let searchQuery  = $state('');
  let filterCat    = $state('');
  let filterStatus = $state('');
  let sortBy       = $state<'default' | 'slots' | 'status' | 'date'>('default');

  let showDeleteConfirm  = $state(false);
  let pendingDeleteId    = $state<string | number | null>(null);
  let pendingDeleteTitle = $state('');

  let form = $state<FormData>({
    title: '', description: '', category: '', slots: '',
    requirements: '', start_date: '', end_date: '',
  });

  let filtered = $derived(
    programs.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch  = !q || p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
      const matchCat     = !filterCat    || p.category === filterCat;
      const matchStatus  = !filterStatus || p.status   === filterStatus;
      return matchSearch && matchCat && matchStatus;
    })
  );

  let sorted = $derived(
    [...filtered].sort((a, b) => {
      if (sortBy === 'slots')  return (b.slots_used / (b.slots || 1)) - (a.slots_used / (a.slots || 1));
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    })
  );

  function clearFilters() { searchQuery = ''; filterCat = ''; filterStatus = ''; }

  onMount(async () => {
    await loadData();
    const urlStatus = page.url.searchParams.get('status');
    if (urlStatus) filterStatus = urlStatus;
  });

  async function loadData() {
    loading = true;
    try {
      [programs, categories] = await Promise.all([apiFetch('/programs'), apiFetch('/categories')]);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    form = { title: '', description: '', category: '', slots: '', requirements: '', start_date: '', end_date: '' };
    editMode = false; showForm = true;
  }

  function openEdit(p: Program) {
    form = { ...p, slots: String(p.slots), description: p.description ?? '' };
    editMode = true; selectedProgram = p; showForm = true;
  }

  async function submitForm() {
    try {
      if (editMode && selectedProgram != null) {
        await apiFetch(`/programs/${selectedProgram.id}`, { method: 'PUT', body: form });
        success = 'Program updated successfully.';
      } else {
        await apiFetch('/programs', { method: 'POST', body: form });
        success = 'Program created successfully.';
      }
      showForm = false;
      await loadData();
      setTimeout(() => success = '', 3000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save program';
    }
  }

  async function setStatus(id: string | number, status: string) {
    try {
      await apiFetch(`/programs/${id}/status`, { method: 'PATCH', body: { status } });
      await loadData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update status';
    }
  }

  function confirmDelete(id: string | number, title: string) {
    pendingDeleteId = id; pendingDeleteTitle = title; showDeleteConfirm = true;
  }

  async function executeDelete() {
    if (pendingDeleteId == null) return;
    try {
      await apiFetch(`/programs/${pendingDeleteId}`, { method: 'DELETE' });
      await loadData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete program';
    } finally {
      showDeleteConfirm = false; pendingDeleteId = null; pendingDeleteTitle = '';
    }
  }

  const statusConfig: Record<ProgramStatus, { label: string; classes: string }> = {
    open:      { label: 'Open',      classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    closed:    { label: 'Closed',    classes: 'bg-slate-100 text-slate-500 border border-slate-200' },
    draft:     { label: 'Draft',     classes: 'bg-amber-100 text-amber-700 border border-amber-200' },
    completed: { label: 'Completed', classes: 'bg-blue-100 text-blue-700 border border-blue-200' },
  };

  const statusLabels: Record<string, string> = {
    open: 'Open / Active', closed: 'Closed', draft: 'Draft', completed: 'Completed',
  };
</script>

<div class="p-4 sm:p-6 space-y-5">

  <!-- Header -->
  <div class="flex items-center justify-between gap-3">
    <div>
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Programs</h1>
      <p class="text-gray-500 text-sm">Manage SK assistance programs</p>
    </div>
    <button onclick={openCreate}
      class="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] shrink-0"
      style="background: #0A1F44;">
      <Plus size={15} /> <span class="hidden sm:inline">New Program</span><span class="sm:hidden">New</span>
    </button>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
  {/if}
  {#if success}
    <div class="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm">{success}</div>
  {/if}

  <!-- Search / Filter / Sort Bar -->
  <div class="bg-white border border-slate-200 rounded-2xl px-4 py-3 space-y-3 shadow-sm">
    <div class="flex flex-wrap gap-3 items-end">

      <!-- Search -->
      <div class="flex-1 min-w-50">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1.5" for="prog-search">
          <Search size={11} /> Search
        </label>
        <div class="flex gap-1.5">
          <div class="relative flex-1">
            <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input id="prog-search" bind:value={searchQuery}
              class="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-slate-50"
              placeholder="Search programs..." />
          </div>
        </div>
      </div>

      <!-- Category Filter -->
      <div class="w-full sm:w-44">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1.5" for="prog-cat">
          <Filter size={11} /> Category
        </label>
        <select id="prog-cat" bind:value={filterCat}
          class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 bg-slate-50 appearance-none">
          <option value="">All Categories</option>
          {#each categories as cat}<option value={cat.name}>{cat.name}</option>{/each}
        </select>
      </div>

      <!-- Status Filter -->
      <div class="w-full sm:w-40">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1.5" for="prog-status">
          <Filter size={11} /> Status
        </label>
        <select id="prog-status" bind:value={filterStatus}
          class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 bg-slate-50 appearance-none">
          <option value="">All Statuses</option>
          <option value="open">Open / Active</option>
          <option value="closed">Closed</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <!-- Sort -->
      <div class="w-full sm:w-44">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1.5" for="prog-sort">
          <ArrowUpDown size={11} /> Sort by
        </label>
        <select id="prog-sort" bind:value={sortBy}
          class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 bg-slate-50 appearance-none">
          <option value="default">Default</option>
          <option value="slots">Slots Filled %</option>
          <option value="status">Status</option>
        </select>
      </div>
    </div>

    <!-- Active filter pills -->
    {#if searchQuery || filterCat || filterStatus}
      <div class="flex items-center gap-2 flex-wrap">
        {#if filterStatus}
          <span class="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
            {statusLabels[filterStatus] ?? filterStatus}
            <button onclick={() => filterStatus = ''} class="ml-1 hover:text-red-500 transition">×</button>
          </span>
        {/if}
        <span class="text-xs text-slate-400">{sorted.length} of {programs.length}</span>
        <button onclick={clearFilters} class="text-xs text-blue-500 hover:underline transition">Clear all</button>
      </div>
    {/if}
  </div>

  <!-- Create / Edit Modal -->
  {#if showForm}
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style="background: rgba(10,31,68,0.5);">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 class="text-base font-bold text-slate-900">{editMode ? 'Edit Program' : 'New Program'}</h2>
            <p class="text-xs text-slate-400 mt-0.5">
              {editMode ? 'Update the program details below' : 'Fill in the details to create a new program'}
            </p>
          </div>
          <button onclick={() => showForm = false} class="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X size={16} />
          </button>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); submitForm(); }} class="px-6 py-5 space-y-4">
          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="title">
              <Hash size={11} /> Program Title <span class="text-red-400">*</span>
            </label>
            <input id="title" bind:value={form.title} required placeholder="e.g. Educational Assistance 2026"
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50" />
          </div>

          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="category">
              <Tag size={11} /> Category <span class="text-red-400">*</span>
            </label>
            <select id="category" bind:value={form.category} required
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50 appearance-none">
              <option value="">Select a category</option>
              {#each categories as cat}<option value={cat.name}>{cat.name}</option>{/each}
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="slots">
              <Users size={11} /> Number of Slots <span class="text-red-400">*</span>
            </label>
            <input id="slots" bind:value={form.slots} type="number" required placeholder="100" min="1"
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50" />
          </div>

          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="desc">
              <AlignLeft size={11} /> Description
            </label>
            <textarea id="desc" bind:value={form.description} placeholder="Program details and objectives..." rows="3"
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50 resize-none"></textarea>
          </div>

          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="req">
              <ListChecks size={11} /> Requirements <span class="text-red-400">*</span>
            </label>
            <textarea id="req" bind:value={form.requirements} required placeholder="List of requirements..." rows="3"
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50 resize-none"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="start">
                <CalendarDays size={11} /> Start Date
              </label>
              <input id="start" bind:value={form.start_date} type="date"
                class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50" />
            </div>
            <div class="space-y-1.5">
              <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="end">
                <CalendarDays size={11} /> End Date
              </label>
              <input id="end" bind:value={form.end_date} type="date"
                class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50" />
            </div>
          </div>

          <div class="flex gap-2 pt-1">
            <button type="submit" class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]" style="background: #0A1F44;">
              {editMode ? 'Save Changes' : 'Create Program'}
            </button>
            <button type="button" onclick={() => showForm = false}
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Delete Confirmation Modal -->
  {#if showDeleteConfirm}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(10,31,68,0.5);">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={18} class="text-red-600" />
          </div>
          <div>
            <h3 class="font-bold text-slate-900 text-sm">Delete Program</h3>
            <p class="text-xs text-slate-500 mt-0.5">This action cannot be undone</p>
          </div>
        </div>
        <p class="text-sm text-slate-600 mb-5">
          Are you sure you want to delete <strong class="text-slate-900">"{pendingDeleteTitle}"</strong>?
        </p>
        <div class="flex gap-2">
          <button onclick={executeDelete}
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition">
            Yes, Delete
          </button>
          <button onclick={() => { showDeleteConfirm = false; pendingDeleteId = null; }}
            class="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Program List -->
  {#if loading}
    <div class="flex items-center gap-2 text-slate-400 text-sm py-12">
      <div class="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      Loading programs...
    </div>

  {:else if sorted.length === 0 && programs.length === 0}
    <div class="bg-white border border-slate-200 rounded-2xl text-center py-16 shadow-sm">
      <FolderOpen size={36} class="mx-auto mb-3 text-slate-300" />
      <p class="text-slate-400 font-medium text-sm">No programs yet.</p>
      <p class="text-slate-300 text-xs mt-1">Click "New Program" to get started.</p>
    </div>

  {:else if sorted.length === 0}
    <div class="bg-white border border-slate-200 rounded-2xl text-center py-16 shadow-sm">
      <Search size={36} class="mx-auto mb-3 text-slate-300" />
      <p class="text-slate-400 font-medium text-sm">No programs match your filters.</p>
      <button onclick={clearFilters} class="text-xs text-blue-500 hover:underline mt-1">Clear all filters</button>
    </div>

  {:else}
    <div class="grid gap-3">
      {#each sorted as p}
        {@const cfg = statusConfig[p.status] ?? statusConfig.closed}
        {@const slotPct = p.slots > 0 ? Math.round(p.slots_used / p.slots * 100) : 0}
        <div class="bg-white border border-slate-200 rounded-2xl px-4 sm:px-5 py-4 hover:shadow-md hover:border-slate-300 transition-all">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <h3 class="font-semibold text-slate-900 text-sm">{p.title}</h3>
                <span class="text-[11px] font-medium px-2 py-0.5 rounded-full {cfg.classes}">{cfg.label}</span>
                <span class="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">{p.category}</span>
              </div>
              <p class="text-slate-400 text-xs mb-3 truncate">{p.description || 'No description provided'}</p>

              <div class="mb-2">
                <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full sm:w-48">
                  <div class="h-full rounded-full transition-all" style="width:{slotPct}%; background:#0A1F44;"></div>
                </div>
              </div>

              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span class="text-slate-400">Slots: <strong class="text-slate-700">{p.slots_used}/{p.slots}</strong> <span class="text-slate-300">({slotPct}%)</span></span>
                <span class="text-slate-400">Pending: <strong class="text-amber-600">{p.pending_count}</strong></span>
                <span class="text-slate-400">Approved: <strong class="text-emerald-600">{p.approved_count}</strong></span>
              </div>
            </div>

            <div class="flex gap-1.5 flex-wrap items-center">
              {#if p.status === 'draft' || p.status === 'closed'}
                <button onclick={() => setStatus(p.id, 'open')}
                  class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition">
                  <ToggleLeft size={13} /> Open
                </button>
              {/if}
              {#if p.status === 'open'}
                <button onclick={() => setStatus(p.id, 'closed')}
                  class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition">
                  <ToggleRight size={13} /> Close
                </button>
              {/if}
              <a href="/applications?program={p.id}"
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition">
                <ClipboardList size={12} /> Applicants
              </a>
              <button onclick={() => openEdit(p)}
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition">
                <Pencil size={12} /> Edit
              </button>
              <button onclick={() => confirmDelete(p.id, p.title)}
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

</div>