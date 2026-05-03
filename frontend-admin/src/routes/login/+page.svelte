<script lang="ts">
  import { goto } from '$app/navigation';
  import { login, apiFetch } from '$lib/api';
  import Lock from 'lucide-svelte/icons/lock';
  import User from 'lucide-svelte/icons/user';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';

  let credential = $state('');   // accepts username OR email
  let password   = $state('');
  let error      = $state('');
  let loading    = $state(false);
  let showPassword = $state(false);

  async function handleLogin() {
    error = ''; loading = true;
    try {
      // Send as "username" — the backend checks both username and email columns
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: { username: credential, password },
      });
      login(res.user, res.token);
      goto('/');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Login failed';
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
    <h1 class="text-white text-base font-bold tracking-wide mb-0 text-center">
      SK Beneficiary Management Portal
    </h1>
    <p class="text-white/60 text-sm mb-4 text-center">
      Authorized Access Only
    </p>

    <div class="w-full border rounded-2xl px-8 py-8"
         style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.10);">
      <p class="text-white/60 text-xs font-semibold uppercase tracking-widest mb-5">SK Portal Login</p>

      <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-3">

        <!-- Username or Email -->
        <div class="relative">
          <User size={14}
            class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style="color: rgba(255,255,255,0.3);" />
          <input
            bind:value={credential}
            placeholder="Username or Email"
            autocomplete="username"
            required
            onfocus={focusBorder}
            onblur={blurBorder}
            class="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
            style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
          />
        </div>

        <!-- Password -->
        <div class="relative">
          <Lock size={14}
            class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style="color: rgba(255,255,255,0.3);" />
          <input
            bind:value={password}
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            autocomplete="current-password"
            required
            onfocus={focusBorder}
            onblur={blurBorder}
            class="w-full rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition"
            style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);"
          />
          <button
            type="button"
            onclick={() => showPassword = !showPassword}
            class="absolute right-3 top-1/2 -translate-y-1/2 transition"
            style="color: rgba(255,255,255,0.3);"
            tabindex="-1"
          >
            {#if showPassword}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
          </button>
        </div>

        <!-- Forgot password -->
        <div class="flex justify-end">
          <a
            href="/forgot-password"
            class="text-xs transition"
            style="color: rgba(255,255,255,0.4);"
            onmouseenter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)'}
            onmouseleave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)'}
          >
            Forgot password?
          </a>
        </div>

        <!-- Error -->
        {#if error}
          <div class="text-xs rounded-lg px-3 py-2"
               style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.3); color: #fca5a5;">
            {error}
          </div>
        {/if}

        <!-- Submit -->
        <button
          type="submit"
          disabled={loading}
          onmouseenter={hoverBtn}
          onmouseleave={leaveBtn}
          class="w-full py-2.5 rounded-lg text-sm font-semibold tracking-wide text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.20);"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>

    <p class="text-white/20 text-xs mt-5">Default: admin / admin123</p>
  </div>
</div>