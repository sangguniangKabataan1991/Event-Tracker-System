<script>
	import '../app.css';
	import { goto } from '$app/navigation';
	import { user, logout } from '$lib/api.js';
	import { page } from '$app/stores';
	import { LogOut, LayoutList, Building2 } from 'lucide-svelte';

	let { children } = $props();

	const FULL_SCREEN_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

	let isFullScreen = $derived(
		FULL_SCREEN_ROUTES.some(
			(r) => $page.url.pathname === r || $page.url.pathname.startsWith(r + '?')
		)
	);

	function handleLogout() {
		logout();
		goto('/login');
	}
</script>

{#if isFullScreen}
	{@render children()}
{:else}
	<div class="min-h-screen bg-slate-50">
		<nav
			class="text-white shadow-lg"
			style="background: #0A1F44; border-bottom: 1px solid rgba(255,255,255,0.08);"
		>
			<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
				<a href="/" class="group flex min-w-0 items-center gap-2">
					<div class="shrink-0 rounded-lg p-1.5 transition" style="background: rgba(255,255,255,0.10);">
						<Building2 class="h-5 w-5" style="color: rgba(255,255,255,0.85);" />
					</div>
					<div class="min-w-0">
						<div class="text-sm font-bold tracking-wide leading-tight">SK Portal</div>
						<div class="hidden sm:block text-xs truncate" style="color: rgba(255,255,255,0.45);">
							Beneficiary Tracking and Management System
						</div>
					</div>
				</a>

				<div class="flex shrink-0 items-center gap-2">
					{#if $user}
						<span class="hidden md:block text-sm" style="color: rgba(255,255,255,0.55);">
							Hi, <strong class="text-white">{$user.full_name.split(' ')[0]}</strong>
						</span>
						<a
							href="/my-applications"
							class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition"
							style="color: rgba(255,255,255,0.75);"
							onmouseenter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
							onmouseleave={(e) => (e.currentTarget.style.background = 'transparent')}
						>
							<LayoutList class="h-4 w-4 shrink-0" />
							<span class="hidden sm:inline">My Applications</span>
						</a>
						<button
							onclick={handleLogout}
							class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm text-white transition"
							style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15);"
							onmouseenter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
							onmouseleave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
						>
							<LogOut class="h-4 w-4 shrink-0" />
							<span class="hidden sm:inline">Sign Out</span>
						</button>
					{:else}
						<a
							href="/login"
							class="rounded-lg px-3 py-1.5 text-sm transition"
							style="color: rgba(255,255,255,0.75);"
							onmouseenter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
							onmouseleave={(e) => (e.currentTarget.style.background = 'transparent')}
						>Login
						</a>
						<a
							href="/register"
							class="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition"
							style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);"
							onmouseenter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
							onmouseleave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
						>Register
						</a>
					{/if}
				</div>
			</div>
		</nav>

		<main class="mx-auto max-w-5xl px-4 py-5 sm:py-6">
			{@render children()}
		</main>
	</div>
{/if}