<script lang="ts">
  import { apiFetch } from '$lib/api';
  import Mail from 'lucide-svelte/icons/mail';
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';

  let email = $state('');
  let error = $state('');
  let success = $state(false);
  let loading = $state(false);

  async function handleSubmit() {
    error = ''; loading = true;
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
      success = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
    } finally { loading = false; }
  }

  function focusBorder(e: FocusEvent) {
    (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.35)';
  }
  function blurBorder(e: FocusEvent) {
    (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.12)';
  }
  function hoverBtn(e: MouseEvent) {
    if (!(e.currentTarget as HTMLButtonElement).disabled)
      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)';
  }
  function leaveBtn(e: MouseEvent) {
    if (!(e.currentTarget as HTMLButtonElement).disabled)
      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
  }
</script>

<div class="min-h-screen flex items-center justify-center p-4" style="background: #0A1F44;">
  <div class="flex flex-col items-center w-full max-w-sm">

    <img src="/logo.png" alt="SK Logo" class="w-35 h-35 object-contain mb-3 opacity-95" />
    <h1 class="text-white text-base font-bold tracking-wide mb-4 text-center">
      SK Personnel Portal - Forgot Password
    </h1>

    <div class="w-full border rounded-2xl px-8 py-8" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.10);">

      {#if success}
        <div class="text-center py-4">
          <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style="background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3);">
            <Mail size={20} style="color: #86efac;" />
          </div>
          <p class="text-white font-semibold text-sm mb-2">Check your email</p>
          <p class="text-white/40 text-xs leading-relaxed mb-6">
            If an account is associated with <span class="text-white/70">{email}</span>, you will receive a password reset link shortly.
          </p>
          <a href="/login"
            class="inline-flex items-center gap-1.5 text-xs transition"
            style="color: rgba(255,255,255,0.4);"
            onmouseenter={(e: MouseEvent) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)'}
            onmouseleave={(e: MouseEvent) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)'}
          >
            Back to Sign In
          </a>
        </div>

      {:else}
        <p class="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Reset your password</p>
        <p class="text-white/30 text-xs mb-5 leading-relaxed">
          Enter the email address associated with your account and we will send you a reset link.
        </p>

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-3">

          <div class="relative">
            <Mail size={14} class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: rgba(255,255,255,0.3);" />
            <input
              bind:value={email}
              type="email"
              placeholder="Email address"
              required
              onfocus={focusBorder}
              onblur={blurBorder}
              class="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
              style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
            />
          </div>

          {#if error}
            <div class="text-xs rounded-lg px-3 py-2" style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.3); color: #fca5a5;">
              {error}
            </div>
          {/if}

          <button
            type="submit"
            disabled={loading}
            onmouseenter={hoverBtn}
            onmouseleave={leaveBtn}
            class="w-full py-2.5 rounded-lg text-sm font-semibold tracking-wide text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.20);"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div class="mt-5 text-center">
          <a href="/login"
            class="inline-flex items-center gap-1.5 text-xs transition"
            style="color: rgba(255,255,255,0.4);"
            onmouseenter={(e: MouseEvent) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)'}
            onmouseleave={(e: MouseEvent) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)'}
          >
            <ArrowLeft size={12} /> Back to Sign In
          </a>
        </div>
      {/if}

    </div>
  </div>
</div>