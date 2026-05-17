<script>
    import '../app.css';
    import { goto } from '$app/navigation';
    import { user, logout } from '$lib/api.js';
    import { page } from '$app/stores';
    import { LogOut, LayoutList } from 'lucide-svelte';

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
        <!-- Navbar -->
        <nav class="w-full text-white shadow-lg" style="background:#0A1F44; border-bottom:1px solid rgba(255,255,255,0.08);">
            
            <div class="flex w-full items-center px-4 py-3">
                
                <!-- Left -->
                <a href="/" class="group flex items-center gap-2.5">
                    <img src="\logo.png" alt="Logo" class="h-10 w-10 object-contain" />
                    <div>
                        <div class="text-sm font-bold tracking-wide">SK Portal</div>
                        <div class="text-xs hidden sm:block" style="color:rgba(255,255,255,0.45);">
                            Beneficiary Tracking and Management System
                        </div>
                    </div>
                </a>

                <!-- Right -->
                <div class="flex items-center gap-2 sm:gap-3 ml-auto">
                    {#if $user}
                        <span class="hidden md:block text-sm" style="color:rgba(255,255,255,0.55);">
                            Welcome, <strong class="text-white">{$user.full_name}</strong>!
                        </span>

                        <a href="/my-applications"
                           class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition"
                           style="color:rgba(255,255,255,0.65);"
                           onmouseenter={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.10)'}
                           onmouseleave={(e)=>e.currentTarget.style.background='transparent'}>
                            <LayoutList class="h-4 w-4" />
                            <span class="hidden sm:inline">My Applications</span>
                        </a>

                        <button onclick={handleLogout}
                                class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-white transition"
                                style="background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.15);"
                                onmouseenter={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.15)'}
                                onmouseleave={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}>
                            <LogOut class="h-4 w-4" />
                            <span class="hidden sm:inline">Sign Out</span>
                        </button>
                    {:else}
                        <a href="/login" class="px-3 py-1.5 text-sm" style="color:rgba(255,255,255,0.65);">
                            Login
                        </a>

                        <a href="/register"
                           class="rounded-lg px-4 py-1.5 text-sm font-medium text-white"
                           style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25);">
                            Register
                        </a>
                    {/if}
                </div>

            </div>
        </nav>

        <!-- Page Content -->
        <main class="mx-auto max-w-5xl px-4 py-6">
            {@render children()}
        </main>
    </div>
{/if}