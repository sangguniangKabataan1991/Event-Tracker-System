<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api';
  import Lock from 'lucide-svelte/icons/lock';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import CheckCircle from 'lucide-svelte/icons/check-circle';
  import XCircle from 'lucide-svelte/icons/x-circle';

  let token       = $state('');
  let fullName    = $state('');
  let validating  = $state(true);
  let tokenValid  = $state(false);
  let tokenError  = $state('');

  let password    = $state('');
  let confirmPass = $state('');
  let showPass    = $state(false);
  let showConfirm = $state(false);
  let loading     = $state(false);
  let error       = $state('');
  let success     = $state(false);

  onMount(async () => {
    token = $page.url.searchParams.get('token') ?? '';
    if (!token) {
      tokenError = 'No reset token found. Please use the link from your email.';
      validating = false;
      return;
    }
    try {
      const res = await apiFetch(`/auth/reset-password/verify?token=${token}`);
      tokenValid = res.valid;
      fullName   = res.full_name ?? '';
    } catch (e) {
      tokenError = e instanceof Error ? e.message : 'Invalid or expired link.';
    } finally {
      validating = false;
    }
  });

  async function handleReset() {
    error = '';
    if (password.length < 6)
      return void (error = 'Password must be at least 6 characters.');
    if (password !== confirmPass)
      return void (error = 'Passwords do not match.');

    loading = true;
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
      });
      success = true;
      setTimeout(() => goto('/login'), 3000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Reset failed. Please try again.';
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

<div class="min-h-screen flex items-center justify-center p-4" style="background: #0A1F44;">
  <div class="flex flex-col items-center w-full max-w-sm">

    <img src="/logo.png" alt="SK Logo" class="w-28 h-28 object-contain mb-3 opacity-95" />
    <h1 class="text-white text-base font-bold tracking-wide mb-4 text-center">
      SK Personnel Portal — Reset Password
    </h1>

    <div class="w-full border rounded-2xl px-8 py-8"
         style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.10);">

      {#if validating}
        <div class="text-center py-6">
          <div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-white/50 text-sm">Verifying reset link...</p>
        </div>

      {:else if success}
        <div class="text-center py-4">
          <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
               style="background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3);">
            <CheckCircle size={24} style="color: #86efac;" />
          </div>
          <p class="text-white font-semibold text-sm mb-2">Password Reset!</p>
          <p class="text-white/40 text-xs leading-relaxed mb-4">
            Your password has been successfully reset. You will be redirected to the login page in 3 seconds.
          </p>
          <a href="/login" class="text-xs underline" style="color: rgba(255,255,255,0.5);">
            Go to Login now →
          </a>
        </div>

      {:else if !tokenValid}
        <div class="text-center py-4">
          <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
               style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.3);">
            <XCircle size={24} style="color: #fca5a5;" />
          </div>
          <p class="text-white font-semibold text-sm mb-2">Link Invalid or Expired</p>
          <p class="text-white/40 text-xs leading-relaxed mb-5">
            {tokenError || 'This reset link is no longer valid. Please request a new one.'}
          </p>
          <a href="/forgot-password"
             class="inline-block text-xs py-2 px-5 rounded-lg text-white transition"
             style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);">
            Request New Link
          </a>
        </div>

      {:else}
        <p class="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Set New Password</p>
        {#if fullName}
          <p class="text-white/40 text-xs mb-5">
            Hi <span class="text-white/70">{fullName}</span>, please choose a new password.
          </p>
        {:else}
          <p class="text-white/40 text-xs mb-5">Choose a new password for your account.</p>
        {/if}

        <form onsubmit={(e) => { e.preventDefault(); handleReset(); }} class="space-y-3">

          <div class="relative">
            <Lock size={14}
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style="color: rgba(255,255,255,0.3);" />
            <input
              bind:value={password}
              type={showPass ? 'text' : 'password'}
              placeholder="New Password (min. 6 chars)"
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
            <Lock size={14}
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style="color: rgba(255,255,255,0.3);" />
            <input
              bind:value={confirmPass}
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm New Password"
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

          {#if error}
            <div class="text-xs rounded-lg px-3 py2"
                 style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.3); color: #fca5a5;">
              {error}
            </div>
          {/if}

          <button
            type="submit"
            disabled={loading}
            class="w-full py-2.5 rounded-lg text-sm font-semibold tracking-wide text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.20);"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div class="mt-4 text-center">
          <a href="/login" class="text-xs transition" style="color: rgba(255,255,255,0.3);"
             onmouseenter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)'}
             onmouseleave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.3)'}>
            ← Back to Login
          </a>
        </div>
      {/if}

    </div>
  </div>
</div>