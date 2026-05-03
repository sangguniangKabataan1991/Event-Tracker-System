<script lang="ts">
  import { onMount } from 'svelte';
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

  type ProgramStatus = 'open' | 'closed' | 'draft' | 'completed';

  interface Program {
    id: string | number;
    title: string;
    description: string;
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
    title: string;
    description: string;
    category: string;
    slots: string;
    requirements: string;
    start_date: string;
    end_date: string;
  }

  let programs = $state<Program[]>([]);
  let categories = $state<Category[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let editMode = $state(false);
  let selectedProgram = $state<Program | null>(null);
  let error = $state('');
  let success = $state('');
  let form = $state<FormData>({
    title: '', description: '', category: '', slots: '',
    requirements: '', start_date: '', end_date: '',
  });

  // Load programs and categories on mount
  onMount(async () => { await loadData(); });

  async function loadData() {
    loading = true;
    try {
      [programs, categories] = await Promise.all([
        apiFetch('/programs'),
        apiFetch('/categories'),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
    } finally {
      loading = false;
    }
  }

  // Open the form in create mode with blank fields
  function openCreate() {
    form = { title: '', description: '', category: '', slots: '', requirements: '', start_date: '', end_date: '' };
    editMode = false;
    showForm = true;
  }

  // Open the form in edit mode pre-filled with the selected program's data
  function openEdit(p: Program) {
    form = { ...p, slots: String(p.slots) };
    editMode = true;
    selectedProgram = p;
    showForm = true;
  }

  // Create or update a program depending on editMode
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

  // Update a program's status (open / closed / completed / draft)
  async function setStatus(id: string | number, status: string) {
    try {
      await apiFetch(`/programs/${id}/status`, { method: 'PATCH', body: { status } });
      await loadData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update status';
    }
  }

  // Delete a program after confirmation
  async function deleteProgram(id: string | number) {
    if (!confirm('Are you sure you want to delete this program? This cannot be undone.')) return;
    try {
      await apiFetch(`/programs/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete program';
    }
  }

  // Badge styles per program status
  const statusConfig: Record<ProgramStatus, { label: string; classes: string }> = {
    open:      { label: 'Open',      classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    closed:    { label: 'Closed',    classes: 'bg-slate-100 text-slate-500 border border-slate-200' },
    draft:     { label: 'Draft',     classes: 'bg-amber-100 text-amber-700 border border-amber-200' },
    completed: { label: 'Completed', classes: 'bg-blue-100 text-blue-700 border border-blue-200' },
  };
</script>

<div class="p-6 space-y-5">

  <!-- Page Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Programs</h1>
      <p class="text-gray-500 text-sm">Manage SK assistance programs</p>
    </div>
    <button
      onclick={openCreate}
      class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
      style="background: #0A1F44;"
    >
      <Plus size={15} /> New Program
    </button>
  </div>

  <!-- Alert Messages -->
  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
  {/if}
  {#if success}
    <div class="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm">{success}</div>
  {/if}

  <!-- ── CREATE / EDIT MODAL ─────────────────────────────────────────────── -->
  {#if showForm}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(10,31,68,0.5);">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <!-- Modal Header -->
        <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 class="text-base font-bold text-slate-900">
              {editMode ? 'Edit Program' : 'New Program'}
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              {editMode ? 'Update the program details below' : 'Fill in the details to create a new program'}
            </p>
          </div>
          <button
            onclick={() => showForm = false}
            class="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X size={16} />
          </button>
        </div>

        <!-- Modal Form -->
        <form onsubmit={(e) => { e.preventDefault(); submitForm(); }} class="px-6 py-5 space-y-4">

          <!-- Program Title -->
          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="title">
              <Hash size={11} /> Program Title <span class="text-red-400">*</span>
            </label>
            <input
              id="title"
              bind:value={form.title}
              required
              placeholder="e.g. Educational Assistance 2026"
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50"
            />
          </div>

          <!-- Category -->
          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="category">
              <Tag size={11} /> Category <span class="text-red-400">*</span>
            </label>
            <select
              id="category"
              bind:value={form.category}
              required
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50 appearance-none"
            >
              <option value="">Select a category</option>
              {#each categories as cat}
                <option value={cat.name}>{cat.name}</option>
              {/each}
            </select>
          </div>

          <!-- Number of Slots -->
          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="slots">
              <Users size={11} /> Number of Slots <span class="text-red-400">*</span>
            </label>
            <input
              id="slots"
              bind:value={form.slots}
              type="number"
              required
              placeholder="100"
              min="1"
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50"
            />
          </div>

          <!-- Description -->
          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="desc">
              <AlignLeft size={11} /> Description
            </label>
            <textarea
              id="desc"
              bind:value={form.description}
              placeholder="Program details and objectives..."
              rows="3"
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50 resize-none"
            ></textarea>
          </div>

          <!-- Requirements -->
          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="req">
              <ListChecks size={11} /> Requirements <span class="text-red-400">*</span>
            </label>
            <textarea
              id="req"
              bind:value={form.requirements}
              required
              placeholder="List of requirements for applicants..."
              rows="3"
              class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50 resize-none"
            ></textarea>
          </div>

          <!-- Date Range -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="start">
                <CalendarDays size={11} /> Start Date
              </label>
              <input
                id="start"
                bind:value={form.start_date}
                type="date"
                class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50"
              />
            </div>
            <div class="space-y-1.5">
              <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide" for="end">
                <CalendarDays size={11} /> End Date
              </label>
              <input
                id="end"
                bind:value={form.end_date}
                type="date"
                class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-slate-50"
              />
            </div>
          </div>

          <!-- Form Actions -->
          <div class="flex gap-2 pt-1">
            <button
              type="submit"
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
              style="background: #0A1F44;"
            >
              {editMode ? 'Save Changes' : 'Create Program'}
            </button>
            <button
              type="button"
              onclick={() => showForm = false}
              class="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  {/if}

  <!-- ── PROGRAM LIST ─────────────────────────────────────────────────────── -->
  {#if loading}
    <div class="flex items-center gap-2 text-slate-400 text-sm py-12">
      <div class="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      Loading programs...
    </div>

  {:else if programs.length === 0}
    <div class="bg-white border border-slate-200 rounded-2xl text-center py-16 shadow-sm">
      <FolderOpen size={36} class="mx-auto mb-3 text-slate-300" />
      <p class="text-slate-400 font-medium text-sm">No programs yet.</p>
      <p class="text-slate-300 text-xs mt-1">Click "New Program" to get started.</p>
    </div>

  {:else}
    <div class="grid gap-3">
      {#each programs as p}
        {@const cfg = statusConfig[p.status] ?? statusConfig.closed}
        <div class="bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:shadow-md hover:border-slate-300 transition-all">
          <div class="flex items-start justify-between gap-4">

            <!-- Program Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <h3 class="font-semibold text-slate-900 text-sm">{p.title}</h3>
                <span class="text-[11px] font-medium px-2 py-0.5 rounded-full {cfg.classes}">{cfg.label}</span>
                <span class="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">{p.category}</span>
              </div>
              <p class="text-slate-400 text-xs mb-3 truncate">{p.description || 'No description provided'}</p>
              <!-- Slot and application summary -->
              <div class="flex gap-4 text-xs">
                <span class="text-slate-400">Slots: <strong class="text-slate-700">{p.slots_used}/{p.slots}</strong></span>
                <span class="text-slate-400">Pending: <strong class="text-amber-600">{p.pending_count}</strong></span>
                <span class="text-slate-400">Approved: <strong class="text-emerald-600">{p.approved_count}</strong></span>
              </div>
            </div>

            <!-- Program Actions -->
            <div class="flex gap-1.5 shrink-0 flex-wrap justify-end items-center">

              <!-- Toggle open/closed based on current status -->
              {#if p.status === 'draft' || p.status === 'closed'}
                <button
                  onclick={() => setStatus(p.id, 'open')}
                  class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition"
                >
                  <ToggleLeft size={13} /> Open
                </button>
              {/if}
              {#if p.status === 'open'}
                <button
                  onclick={() => setStatus(p.id, 'closed')}
                  class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition"
                >
                  <ToggleRight size={13} /> Close
                </button>
              {/if}

              <!-- View applicants for this program -->
              <a
                href="/applications?program={p.id}"
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition"
              >
                <ClipboardList size={12} /> Applicants
              </a>

              <!-- Edit program -->
              <button
                onclick={() => openEdit(p)}
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition"
              >
                <Pencil size={12} /> Edit
              </button>

              <!-- Delete program -->
              <button
                onclick={() => deleteProgram(p.id)}
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition"
              >
                <Trash2 size={12} /> Delete
              </button>

            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

</div>