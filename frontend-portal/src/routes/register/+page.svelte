<script lang="ts">
  import { goto } from '$app/navigation';
  import { login, apiFetch } from '$lib/api.js';
  import User from 'lucide-svelte/icons/user';
  import Lock from 'lucide-svelte/icons/lock';
  import Phone from 'lucide-svelte/icons/phone';
  import MapPin from 'lucide-svelte/icons/map-pin';
  import Mail from 'lucide-svelte/icons/mail';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';

  let form = $state({
    username:        '',
    password:        '',
    confirmPassword: '',
    full_name:       '',
    email:           '',
    contact:         '',
    address:         '',
    barangay:        '',
  });
  let error       = $state('');
  let loading     = $state(false);
  let showPass    = $state(false);
  let showConfirm = $state(false);

  async function handleRegister() {
    error = '';
    if (form.password !== form.confirmPassword) {
      error = 'Passwords do not match.';
      return;
    }
    if (form.password.length < 6) {
      error = 'Password must be at least 6 characters.';
      return;
    }
    loading = true;
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: {
          username:  form.username,
          password:  form.password,
          full_name: form.full_name,
          email:     form.email    || undefined,
          contact:   form.contact,
          address:   form.address,
          barangay:  form.barangay,
        },
      });
      login(res.user, res.token);
      goto('/');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Registration failed';
    } finally {
      loading = false;
    }
  }

  function focusBorder(e: FocusEvent) {
    (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.35)';
  }
  function blurBorder(e: FocusEvent) {
    (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.12)';
  }
</script>

<div class="min-h-screen flex items-center justify-center p-4 py-10" style="background: #0A1F44;">
  <div class="flex flex-col items-center w-full max-w-sm">

    <img src="/logo.png" alt="SK Logo" class="w-24 h-24 object-contain mb-3 opacity-95" />
    <h1 class="text-white text-base font-bold tracking-wide mb-1 text-center">
      SK Beneficiary Portal
    </h1>
    <p class="text-white/60 text-sm mb-5 text-center">Create an account to apply for SK programs</p>

    <div class="w-full border rounded-2xl px-8 py-8"
         style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.10);">

      <p class="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">Personal Information</p>

      <div class="space-y-3">
        <div class="relative">
          <User size={14} class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: rgba(255,255,255,0.3);" />
          <input
            bind:value={form.full_name}
            placeholder="Full Name *"
            required
            onfocus={focusBorder}
            onblur={blurBorder}
            class="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
            style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="relative">
            <Phone size={13} class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: rgba(255,255,255,0.3);" />
            <input
              bind:value={form.contact}
              placeholder="Contact No. *"
              required
              onfocus={focusBorder}
              onblur={blurBorder}
              class="w-full rounded-lg pl-8 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
              style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
            />
          </div>
          <div class="relative">
            <MapPin size={13} class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: rgba(255,255,255,0.3);" />
            <input
              bind:value={form.barangay}
              placeholder="Barangay *"
              required
              onfocus={focusBorder}
              onblur={blurBorder}
              class="w-full rounded-lg pl-8 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
              style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
            />
          </div>
        </div>

        <div class="relative">
          <MapPin size={14} class="absolute left-3 top-3 pointer-events-none" style="color: rgba(255,255,255,0.3);" />
          <textarea
            bind:value={form.address}
            placeholder="Full Address (Blk/Lot, Street, Barangay, City) *"
            required
            rows={2}
            onfocus={focusBorder}
            onblur={blurBorder}
            class="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition resize-none"
            style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
          ></textarea>
        </div>
      </div>

      <div class="my-5" style="border-top: 1px solid rgba(255,255,255,0.08);"></div>

      <p class="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">Account Information</p>

      <div class="space-y-3">
        <div class="relative">
          <User size={14} class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: rgba(255,255,255,0.3);" />
          <input
            bind:value={form.username}
            placeholder="Username *"
            autocomplete="username"
            required
            onfocus={focusBorder}
            onblur={blurBorder}
            class="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
            style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
          />
        </div>

        <div class="relative">
          <Mail size={14} class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: rgba(255,255,255,0.3);" />
          <input
            bind:value={form.email}
            type="email"
            placeholder="Email Address "
            onfocus={focusBorder}
            onblur={blurBorder}
            class="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
            style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
          />
        </div>

        <div class="relative">
          <Lock size={14} class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: rgba(255,255,255,0.3);" />
          <input
            bind:value={form.password}
            type={showPass ? 'text' : 'password'}
            placeholder="Password *"
            autocomplete="new-password"
            required
            onfocus={focusBorder}
            onblur={blurBorder}
            class="w-full rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
            style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
          />
          <button type="button" onclick={() => showPass = !showPass}
            class="absolute right-3 top-1/2 -translate-y-1/2 transition"
            style="color: rgba(255,255,255,0.3);" tabindex="-1">
            {#if showPass}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
          </button>
        </div>

        <div class="relative">
          <Lock size={14} class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: rgba(255,255,255,0.3);" />
          <input
            bind:value={form.confirmPassword}
            type={showConfirm ? 'text' : 'password'}
            placeholder="Confirm Password *"
            autocomplete="new-password"
            required
            onfocus={focusBorder}
            onblur={blurBorder}
            class="w-full rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
            style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
          />
          <button type="button" onclick={() => showConfirm = !showConfirm}
            class="absolute right-3 top-1/2 -translate-y-1/2 transition"
            style="color: rgba(255,255,255,0.3);" tabindex="-1">
            {#if showConfirm}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
          </button>
        </div>
      </div>

      {#if error}
        <div class="mt-3 text-xs rounded-lg px-3 py-2"
             style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.3); color: #fca5a5;">
          {error}
        </div>
      {/if}

      <button
        type="button"
        onclick={handleRegister}
        disabled={loading}
        onmouseenter={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)'; }}
        onmouseleave={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; }}
        class="mt-5 w-full py-2.5 rounded-lg text-sm font-semibold tracking-wide text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
        style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.20);"
      >
        {loading ? 'Creating account...' : 'Create Account'}
      </button>

      <div class="mt-4 text-center">
        <a
          href="/login"
          class="inline-flex items-center gap-1.5 text-xs transition"
          style="color: rgba(255,255,255,0.4);"
          onmouseenter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)'}
          onmouseleave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)'}
        >
          <ArrowLeft size={12} /> Already have an account? Sign in
        </a>
      </div>

    </div>
  </div>
</div>