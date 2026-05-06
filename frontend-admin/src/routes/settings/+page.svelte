<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api.js';
  import Plus from 'lucide-svelte/icons/plus';
  import Tag from 'lucide-svelte/icons/tag';
  import ShieldCheck from 'lucide-svelte/icons/shield-check';
  import UserPlus from 'lucide-svelte/icons/user-plus';
  import X from 'lucide-svelte/icons/x';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import Pencil from 'lucide-svelte/icons/pencil';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Save from 'lucide-svelte/icons/save';
  import MapPin from 'lucide-svelte/icons/map-pin';
  import Phone from 'lucide-svelte/icons/phone';
  import User from 'lucide-svelte/icons/user';
  import Building2 from 'lucide-svelte/icons/building-2';
  import BadgeCheck from 'lucide-svelte/icons/badge-check';
  import Mail from 'lucide-svelte/icons/mail';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';

  interface Category    { name: string; }
  interface UserRow     { id: number; full_name: string; username: string; role: string; position: string | null; email: string | null; }
  interface UserForm    { full_name: string; username: string; password: string; position: string; email: string; }
  interface BarangayInfo {
    barangay_name: string; sk_chairperson: string;
    contact: string; address: string; municipality: string;
  }

  const POSITION_PRESETS = [
    'SK Chairperson',
    'SK Kagawad',
    'SK Secretary',
    'SK Treasurer',
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  let categories   = $state<Category[]>([]);
  let users        = $state<UserRow[]>([]);
  let barangayInfo = $state<BarangayInfo>({
    barangay_name: '', sk_chairperson: '', contact: '', address: '', municipality: ''
  });
  let newCat   = $state('');
  let error    = $state('');
  let success  = $state('');

  // Add User modal
  let showAddUser     = $state(false);
  let showPassword    = $state(false);
  let userForm        = $state<UserForm>({ full_name: '', username: '', password: '', position: '', email: '' });
  let customPosition  = $state('');
  let usingCustomPos  = $state(false);
  let userFormError   = $state('');
  let userFormLoading = $state(false);

  // Edit User modal
  let showEditUser     = $state(false);
  let editingUser      = $state<UserRow | null>(null);
  let editForm         = $state({ full_name: '', username: '', position: '', password: '', email: '' });
  let editCustomPos    = $state('');
  let editUsingCustom  = $state(false);
  let editShowPassword = $state(false);
  let editFormError    = $state('');
  let editFormLoading  = $state(false);

  // Delete confirm modal
  let showDeleteConfirm = $state(false);
  let deletingUser      = $state<UserRow | null>(null);
  let deleteLoading     = $state(false);

  // Barangay info
  let editingBarangay = $state(false);
  let barangayLoading = $state(false);

  // ── Load data ──────────────────────────────────────────────────────────────
  onMount(async () => {
    [categories, users] = await Promise.all([apiFetch('/categories'), apiFetch('/users')]);
    try { barangayInfo = await apiFetch('/barangay-info'); } catch {}
  });

  function flash(msg: string, type: 'success' | 'error' = 'success') {
    if (type === 'success') { success = msg; error = ''; }
    else { error = msg; success = ''; }
    setTimeout(() => { success = ''; error = ''; }, 3500);
  }

  function resolvePosition(preset: string, custom: string, usingCustom: boolean): string {
    return usingCustom ? custom.trim() : preset.trim();
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  async function addCategory() {
    if (!newCat.trim()) return;
    try {
      await apiFetch('/categories', { method: 'POST', body: { name: newCat.trim() } });
      categories = await apiFetch('/categories');
      newCat = '';
      flash('Category added!');
    } catch (e) { flash(e instanceof Error ? e.message : 'Error', 'error'); }
  }

  async function deleteCategory(name: string) {
    if (!confirm(`Delete category "${name}"? Programs using this category will not be affected.`)) return;
    try {
      await apiFetch(`/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
      categories = await apiFetch('/categories');
      flash('Category deleted.');
    } catch (e) { flash(e instanceof Error ? e.message : 'Error', 'error'); }
  }

  // ── Add User ───────────────────────────────────────────────────────────────
  function openAddUser() {
    userForm       = { full_name: '', username: '', password: '', position: '', email: '' };
    customPosition = '';
    usingCustomPos = false;
    userFormError  = '';
    showPassword   = false;
    showAddUser    = true;
  }

  function handleAddPreset(preset: string) {
    if (preset === '__custom__') {
      usingCustomPos    = true;
      userForm.position = '';
    } else {
      usingCustomPos    = false;
      userForm.position = preset;
    }
  }

  async function addUser() {
    userFormError = '';
    const position = resolvePosition(userForm.position, customPosition, usingCustomPos);

    if (!userForm.full_name || !userForm.username || !userForm.password)
      return void (userFormError = 'Full name, username, and password are required.');
    if (!userForm.email.trim())
      return void (userFormError = 'Email address is required.');
    if (userForm.password.length < 6)
      return void (userFormError = 'Password must be at least 6 characters.');
    if (!position)
      return void (userFormError = 'Please select or enter a position.');

    userFormLoading = true;
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: {
          full_name: userForm.full_name,
          username:  userForm.username,
          password:  userForm.password,
          position,
          email:     userForm.email.trim(),
        }
      });
      users = await apiFetch('/users');
      showAddUser = false;
      flash('User account created!');
    } catch (e) { userFormError = e instanceof Error ? e.message : 'Error creating user'; }
    finally { userFormLoading = false; }
  }

  // ── Edit User ──────────────────────────────────────────────────────────────
  function openEditUser(u: UserRow) {
    editingUser = u;
    const isPreset = POSITION_PRESETS.includes(u.position ?? '');
    editForm         = { full_name: u.full_name, username: u.username, position: isPreset ? (u.position ?? '') : '', password: '', email: u.email ?? '' };
    editCustomPos    = isPreset ? '' : (u.position ?? '');
    editUsingCustom  = !isPreset && !!u.position;
    editFormError    = '';
    editShowPassword = false;
    showEditUser     = true;
  }

  function handleEditPreset(preset: string) {
    if (preset === '__custom__') {
      editUsingCustom   = true;
      editForm.position = '';
    } else {
      editUsingCustom   = false;
      editForm.position = preset;
    }
  }

  async function saveEditUser() {
    if (!editingUser) return;
    editFormError = '';
    const position = resolvePosition(editForm.position, editCustomPos, editUsingCustom);

    if (!editForm.full_name)
      return void (editFormError = 'Full name is required.');
    if (!editForm.username.trim())
      return void (editFormError = 'Username is required.');
    if (!editForm.email.trim())
      return void (editFormError = 'Email address is required.');
    if (!position)
      return void (editFormError = 'Please select or enter a position.');
    if (editForm.password && editForm.password.length < 6)
      return void (editFormError = 'Password must be at least 6 characters.');

    editFormLoading = true;
    try {
      await apiFetch(`/users/${editingUser.id}`, {
        method: 'PUT',
        body: {
          full_name: editForm.full_name,
          username:  editForm.username.trim(),
          position,
          password:  editForm.password,
          email:     editForm.email.trim(),
        }
      });
      users = await apiFetch('/users');
      showEditUser = false;
      flash('User updated successfully!');
    } catch (e) { editFormError = e instanceof Error ? e.message : 'Error updating user'; }
    finally { editFormLoading = false; }
  }

  // ── Delete User ────────────────────────────────────────────────────────────
  function openDeleteConfirm(u: UserRow) {
    deletingUser      = u;
    deleteLoading     = false;
    showDeleteConfirm = true;
  }

  async function confirmDeleteUser() {
    if (!deletingUser) return;
    deleteLoading = true;
    try {
      await apiFetch(`/users/${deletingUser.id}`, { method: 'DELETE' });
      // Optimistically remove from list immediately
      users = users.filter(u => u.id !== deletingUser!.id);
      // Then re-fetch to confirm sync with server
      users = await apiFetch('/users');
      showDeleteConfirm = false;
      deletingUser = null;
      flash('Account deleted successfully.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Error deleting user', 'error');
      showDeleteConfirm = false;
    } finally {
      deleteLoading = false;
    }
  }

  // ── Barangay Info ──────────────────────────────────────────────────────────
  async function saveBarangayInfo() {
    barangayLoading = true;
    try {
      await apiFetch('/barangay-info', { method: 'PUT', body: barangayInfo });
      editingBarangay = false;
      flash('Barangay information saved!');
    } catch (e) { flash(e instanceof Error ? e.message : 'Error saving', 'error'); }
    finally { barangayLoading = false; }
  }

  // ── Position badge color ───────────────────────────────────────────────────
  function positionBadgeClass(role: string, position: string | null): string {
    if (role === 'admin')                        return 'bg-purple-100 text-purple-700';
    if (position === 'SK Chairperson')           return 'bg-purple-100 text-purple-700';
    if (position === 'SK Secretary')             return 'bg-blue-100 text-blue-700';
    if (position === 'SK Treasurer')             return 'bg-emerald-100 text-emerald-700';
    if (position?.startsWith('SK Kagawad'))      return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  }

  function displayPosition(u: UserRow): string {
    if (u.position) return u.position;
    if (u.role === 'admin') return 'SK Chairperson';
    return 'SK Staff';
  }
</script>

<div class="p-4 sm:p-6 space-y-6">

  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
    <p class="text-gray-500 text-sm">System configuration and account management</p>
  </div>

  <!-- Flash Messages -->
  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
  {/if}
  {#if success}
    <div class="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-sm">{success}</div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════════════
       DELETE CONFIRM MODAL
  ══════════════════════════════════════════════════════════════════════ -->
  {#if showDeleteConfirm && deletingUser}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(10,31,68,0.55);">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div class="flex flex-col items-center text-center mb-5">
          <div class="w-14 h-14 rounded-full flex items-center justify-center mb-3" style="background:#FEF2F2;">
            <AlertTriangle size={28} class="text-red-500" />
          </div>
          <h2 class="text-lg font-bold text-gray-900">Delete Account?</h2>
          <p class="text-sm text-gray-500 mt-1">
            You are about to permanently delete the account of
            <span class="font-semibold text-gray-800">{deletingUser.full_name}</span>.
            This cannot be undone.
          </p>
        </div>

        <!-- User preview -->
        <div class="bg-gray-50 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
               style="background:#0A1F44;">
            {deletingUser.full_name.charAt(0)}
          </div>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-gray-900 truncate">{deletingUser.full_name}</div>
            <div class="text-xs text-gray-400 truncate">@{deletingUser.username} · {displayPosition(deletingUser)}</div>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            onclick={confirmDeleteUser}
            disabled={deleteLoading}
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            style="background:#DC2626;">
            <Trash2 size={14} /> {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
          </button>
          <button
            onclick={() => { showDeleteConfirm = false; deletingUser = null; }}
            disabled={deleteLoading}
            class="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition disabled:opacity-60">
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════════════
       ADD USER MODAL
  ══════════════════════════════════════════════════════════════════════ -->
  {#if showAddUser}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" style="background:rgba(10,31,68,0.5);">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 overflow-y-auto max-h-[92vh]">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-lg font-bold text-gray-900">Add New SK Officer</h2>
            <p class="text-sm text-gray-500">Create an account for an SK officer</p>
          </div>
          <button onclick={() => showAddUser = false}
            class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X size={18} /></button>
        </div>

        {#if userFormError}
          <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">{userFormError}</div>
        {/if}

        <div class="space-y-4">
          <div>
            <label class="label" for="add_fn">Full Name *</label>
            <input id="add_fn" bind:value={userForm.full_name} class="input" placeholder="e.g. Juan Dela Cruz" required />
          </div>
          <div>
            <label class="label" for="add_un">Username *</label>
            <input id="add_un" bind:value={userForm.username} class="input" placeholder="e.g. jdelacruz" required />
          </div>
          <div>
            <label class="label" for="add_em">
              <span class="flex items-center gap-1.5"><Mail size={13} class="text-gray-400" /> Email Address *</span>
            </label>
            <input id="add_em" type="email" bind:value={userForm.email} class="input" placeholder="e.g. juan@gmail.com" required />
            <p class="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Mail size={11} /> Used to uniquely identify the officer and send login credentials.
            </p>
          </div>
          <div>
            <label class="label" for="add_pw">Password *</label>
            <div class="relative">
              <input id="add_pw" type={showPassword ? 'text' : 'password'}
                bind:value={userForm.password} class="input pr-10" placeholder="Min. 6 characters" required />
              <button type="button" onclick={() => showPassword = !showPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {#if showPassword}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
              </button>
            </div>
          </div>
          <div>
            <label class="label flex items-center gap-1.5">
              <BadgeCheck size={13} class="text-gray-400" /> Position / Role *
            </label>
            <p class="text-xs text-gray-400 mb-2">Select a preset or enter a custom position title.</p>
            <div class="flex flex-wrap gap-2 mb-3">
              {#each POSITION_PRESETS as preset}
                <button type="button" onclick={() => handleAddPreset(preset)}
                  class="px-3 py-1.5 rounded-lg text-xs font-medium border transition
                    {!usingCustomPos && userForm.position === preset
                      ? 'border-[#0A1F44] bg-[#0A1F44] text-white'
                      : 'border-gray-200 text-gray-600 hover:border-[#0A1F44]/40 hover:bg-[#0A1F44]/5'}">
                  {preset}
                </button>
              {/each}
              <button type="button" onclick={() => handleAddPreset('__custom__')}
                class="px-3 py-1.5 rounded-lg text-xs font-medium border transition
                  {usingCustomPos ? 'border-[#0A1F44] bg-[#0A1F44] text-white' : 'border-dashed border-gray-300 text-gray-500 hover:border-[#0A1F44]/40'}">
                Other…
              </button>
            </div>
            {#if usingCustomPos}
              <input bind:value={customPosition} class="input" placeholder="e.g. SK Youth Rep, SK Committee Head..." />
            {/if}
            {#if !usingCustomPos && userForm.position}
              <div class="mt-2 flex items-center gap-1.5 text-xs text-[#0A1F44] font-medium">
                <BadgeCheck size={12} /> Selected: <span class="font-bold">{userForm.position}</span>
              </div>
            {:else if usingCustomPos && customPosition}
              <div class="mt-2 flex items-center gap-1.5 text-xs text-[#0A1F44] font-medium">
                <BadgeCheck size={12} /> Custom: <span class="font-bold">{customPosition}</span>
              </div>
            {/if}
          </div>
        </div>

        <div class="flex gap-2 mt-5">
          <button onclick={addUser} disabled={userFormLoading}
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style="background:#0A1F44;">
            <UserPlus size={15} /> {userFormLoading ? 'Creating...' : 'Create Account'}
          </button>
          <button onclick={() => showAddUser = false} class="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════════════
       EDIT USER MODAL
  ══════════════════════════════════════════════════════════════════════ -->
  {#if showEditUser && editingUser}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(10,31,68,0.5);">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-lg font-bold text-gray-900">Edit Officer</h2>
            <p class="text-sm text-gray-500">@{editingUser.username}</p>
          </div>
          <button onclick={() => showEditUser = false}
            class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X size={18} /></button>
        </div>

        {#if editFormError}
          <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">{editFormError}</div>
        {/if}

        <div class="space-y-4">
          <div>
            <label class="label" for="edit_fn">Full Name *</label>
            <input id="edit_fn" bind:value={editForm.full_name} class="input" required />
          </div>
          <div>
            <label class="label" for="edit_un">Username *</label>
            <input id="edit_un" bind:value={editForm.username} class="input" placeholder="e.g. jdelacruz" required />
          </div>
          <div>
            <label class="label" for="edit_em">
              <span class="flex items-center gap-1.5"><Mail size={13} class="text-gray-400" /> Email Address *</span>
            </label>
            <input id="edit_em" type="email" bind:value={editForm.email} class="input" placeholder="e.g. juan@gmail.com" required />
            <p class="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Mail size={11} /> Used to uniquely identify this officer across the system.
            </p>
          </div>
          <div>
            <label class="label flex items-center gap-1.5">
              <BadgeCheck size={13} class="text-gray-400" /> Position / Role *
            </label>
            <div class="flex flex-wrap gap-2 mb-3">
              {#each POSITION_PRESETS as preset}
                <button type="button" onclick={() => handleEditPreset(preset)}
                  class="px-3 py-1.5 rounded-lg text-xs font-medium border transition
                    {!editUsingCustom && editForm.position === preset
                      ? 'border-[#0A1F44] bg-[#0A1F44] text-white'
                      : 'border-gray-200 text-gray-600 hover:border-[#0A1F44]/40 hover:bg-[#0A1F44]/5'}">
                  {preset}
                </button>
              {/each}
              <button type="button" onclick={() => handleEditPreset('__custom__')}
                class="px-3 py-1.5 rounded-lg text-xs font-medium border transition
                  {editUsingCustom ? 'border-[#0A1F44] bg-[#0A1F44] text-white' : 'border-dashed border-gray-300 text-gray-500 hover:border-[#0A1F44]/40'}">
                Other…
              </button>
            </div>
            {#if editUsingCustom}
              <input bind:value={editCustomPos} class="input" placeholder="e.g. SK Youth Rep, SK Committee Head..." />
            {/if}
            {#if !editUsingCustom && editForm.position}
              <div class="mt-2 flex items-center gap-1.5 text-xs text-[#0A1F44] font-medium">
                <BadgeCheck size={12} /> Selected: <span class="font-bold">{editForm.position}</span>
              </div>
            {:else if editUsingCustom && editCustomPos}
              <div class="mt-2 flex items-center gap-1.5 text-xs text-[#0A1F44] font-medium">
                <BadgeCheck size={12} /> Custom: <span class="font-bold">{editCustomPos}</span>
              </div>
            {/if}
          </div>
          <div>
            <label class="label" for="edit_pw">
              New Password <span class="text-gray-400 font-normal">(leave blank to keep current)</span>
            </label>
            <div class="relative">
              <input id="edit_pw" type={editShowPassword ? 'text' : 'password'}
                bind:value={editForm.password} class="input pr-10" placeholder="Min. 6 characters" />
              <button type="button" onclick={() => editShowPassword = !editShowPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {#if editShowPassword}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
              </button>
            </div>
          </div>
        </div>

        <div class="flex gap-2 mt-5">
          <button onclick={saveEditUser} disabled={editFormLoading}
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style="background:#0A1F44;">
            <Save size={15} /> {editFormLoading ? 'Saving...' : 'Save Changes'}
          </button>
          <button onclick={() => showEditUser = false} class="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════════════
       BARANGAY INFORMATION
  ══════════════════════════════════════════════════════════════════════ -->
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-semibold text-gray-800 flex items-center gap-2">
        <Building2 size={16} style="color:#0A1F44;" /> Barangay Information
      </h2>
      {#if !editingBarangay}
        <button onclick={() => editingBarangay = true}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#0A1F44] border border-[#0A1F44]/20 hover:bg-[#0A1F44]/5 transition">
          <Pencil size={13} /> Edit
        </button>
      {/if}
    </div>

    {#if editingBarangay}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="label" for="bi_brgy">Barangay Name *</label>
          <input id="bi_brgy" bind:value={barangayInfo.barangay_name} class="input" />
        </div>
        <div>
          <label class="label" for="bi_mun">Municipality / City</label>
          <input id="bi_mun" bind:value={barangayInfo.municipality} class="input" />
        </div>
        <div>
          <label class="label" for="bi_chair">SK Chairperson</label>
          <input id="bi_chair" bind:value={barangayInfo.sk_chairperson} class="input" />
        </div>
        <div>
          <label class="label" for="bi_contact">Contact Number</label>
          <input id="bi_contact" bind:value={barangayInfo.contact} class="input" />
        </div>
        <div class="md:col-span-2">
          <label class="label" for="bi_addr">Full Address</label>
          <input id="bi_addr" bind:value={barangayInfo.address} class="input" />
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick={saveBarangayInfo} disabled={barangayLoading}
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style="background:#0A1F44;">
          <Save size={15} /> {barangayLoading ? 'Saving...' : 'Save Changes'}
        </button>
        <button onclick={() => editingBarangay = false} class="btn-ghost">Cancel</button>
      </div>
    {:else}
      {#if !barangayInfo.barangay_name}
        <div class="text-center py-6 text-gray-400">
          <Building2 size={28} class="mx-auto mb-2 text-gray-300" />
          <p class="text-sm">No barangay information set yet.</p>
          <button onclick={() => editingBarangay = true} class="text-xs mt-1 underline" style="color:#0A1F44;">Add now</button>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex items-start gap-3">
            <Building2 size={16} class="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-gray-400">Barangay</div>
              <div class="text-sm font-medium">{barangayInfo.barangay_name}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <MapPin size={16} class="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-gray-400">Municipality / City</div>
              <div class="text-sm font-medium">{barangayInfo.municipality || '—'}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <User size={16} class="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-gray-400">SK Chairperson</div>
              <div class="text-sm font-medium">{barangayInfo.sk_chairperson || '—'}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <Phone size={16} class="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-gray-400">Contact Number</div>
              <div class="text-sm font-medium">{barangayInfo.contact || '—'}</div>
            </div>
          </div>
          {#if barangayInfo.address}
            <div class="md:col-span-2 flex items-start gap-3">
              <MapPin size={16} class="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div class="text-xs text-gray-400">Address</div>
                <div class="text-sm font-medium">{barangayInfo.address}</div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════
       CATEGORIES & SYSTEM ACCOUNTS
  ══════════════════════════════════════════════════════════════════════ -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

    <!-- Program Categories -->
    <div class="card">
      <h2 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <Tag size={16} style="color:#0A1F44;" /> Program Categories
      </h2>
      <p class="text-xs text-gray-400 mb-4">These categories appear in the program creation form.</p>
      <div class="flex gap-2 mb-4">
        <input bind:value={newCat} class="input flex-1" placeholder="New category name..."
          onkeydown={(e) => e.key === 'Enter' && addCategory()} />
        <button onclick={addCategory}
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style="background:#0A1F44;">
          <Plus size={15} /> Add
        </button>
      </div>
      <div class="space-y-1.5">
        {#each categories as cat}
          <div class="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 group hover:bg-[#0A1F44]/5 transition">
            <span class="w-2 h-2 rounded-full shrink-0" style="background:#0A1F44;"></span>
            <span class="text-sm flex-1">{cat.name}</span>
            <button onclick={() => deleteCategory(cat.name)}
              class="opacity-0 group-hover:opacity-100 transition p-1 rounded-lg hover:bg-red-100 text-red-500"
              title="Delete category">
              <Trash2 size={13} />
            </button>
          </div>
        {/each}
      </div>
    </div>

    <!-- SK Officers -->
    <div class="card">
      <div class="flex items-center justify-between mb-1">
        <h2 class="font-semibold text-gray-800 flex items-center gap-2">
          <ShieldCheck size={16} style="color:#0A1F44;" /> SK Officers
        </h2>
        <button onclick={openAddUser}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition hover:opacity-90"
          style="background:#0A1F44;">
          <UserPlus size={13} /> Add Officer
        </button>
      </div>
      <p class="text-xs text-gray-400 mb-4">SK officers who can access this admin dashboard.</p>

      <div class="space-y-2">
        {#each users.filter(u => u.role !== 'applicant') as u (u.id)}
          <div class="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-[#0A1F44]/5 transition">
            <!-- Avatar -->
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                 style="background:#0A1F44;">
              {u.full_name?.charAt(0)}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900">{u.full_name}</div>
              <div class="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                <span>@{u.username}</span>
                {#if u.email}
                  <span class="flex items-center gap-0.5 text-gray-400">
                    <Mail size={10} /> {u.email}
                  </span>
                {:else}
                  <span class="text-red-500 text-[10px] font-medium">No email set</span>
                {/if}
              </div>
            </div>

            <!-- Position badge -->
            <span class="text-[11px] px-2.5 py-0.5 rounded-full font-semibold shrink-0 {positionBadgeClass(u.role, u.position)}">
              {displayPosition(u)}
            </span>

            <!-- Action buttons — always visible, no hover-only -->
            {#if u.role !== 'admin'}
              <div class="flex gap-1 shrink-0">
                <button onclick={() => openEditUser(u)}
                  class="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition"
                  title="Edit officer">
                  <Pencil size={14} />
                </button>
                <button onclick={() => openDeleteConfirm(u)}
                  class="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition"
                  title="Delete officer">
                  <Trash2 size={14} />
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

  </div>
</div>