<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api.js';
	import { user } from '$lib/api.js';
	import {
		Inbox,
		CircleCheck,
		CircleAlert,
		UserPlus,
		LogIn,
		Users,
		CalendarDays,
		ChevronRight
	} from 'lucide-svelte';

	interface Program {
		id: number;
		title: string;
		category: string;
		description?: string;
		slots: number;
		slots_used: number;
		start_date?: string;
		end_date?: string;
		requirements?: string;
	}

	let programs = $state<Program[]>([]);
	let loading = $state(true);
	let error = $state('');

	let appliedPrograms = $state<number[]>([]);

	onMount(async () => {
		try {
			programs = await apiFetch('/programs?status=open');

			if ($user) {
				const myApplications = await apiFetch('/applications/my');
				appliedPrograms = myApplications.map((app: { program_id: number }) => app.program_id);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Error';
		} finally {
			loading = false;
		}
	});

	function hasApplied(programId: number) {
		return appliedPrograms.includes(programId);
	}
</script>

<div class="space-y-6">
	<!-- Hero -->
	<div
		class="rounded-2xl p-8 text-center text-white shadow-lg"
		style="background: linear-gradient(135deg, #0A1F44 0%, #0d2756 60%, #162d5e 100%);"
	>
		<div class="mb-3 flex justify-center">
			<img src="/logo.png" alt="Logo" class="h-26 w-26 object-contain" />
		</div>

		<h1 class="mb-2 text-2xl font-bold tracking-tight">SK Beneficiary Programs</h1>

		<p class="mx-auto max-w-sm text-sm" style="color: rgba(255,255,255,0.65);">
			Apply for available SK programs and manage your applications easily through our portal.
		</p>

		{#if !$user}
			<div class="mt-5 flex justify-center gap-3">
				<a
					href="/register"
					class="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold shadow transition"
					style="background: white; color: #0A1F44;"
				>
					<UserPlus class="h-4 w-4" />
					Register
				</a>

				<a
					href="/login"
					class="flex items-center gap-2 rounded-lg border px-5 py-2 text-sm text-white transition"
					style="background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.25);"
				>
					<LogIn class="h-4 w-4" />
					Login
				</a>
			</div>
		{/if}
	</div>

	<!-- Programs List -->
	<div>
		<h2 class="mb-4 text-lg font-bold text-slate-800">Available Programs</h2>

		{#if loading}
			<div class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300"
					style="border-top-color: #0A1F44;"
				></div>
				Loading programs...
			</div>
		{:else if error}
			<div
				class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
			>
				<CircleAlert class="h-4 w-4 shrink-0" />
				{error}
			</div>
		{:else if programs.length === 0}
			<div class="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
				<Inbox class="mx-auto mb-3 h-10 w-10 text-slate-300" />
				<p class="font-medium text-slate-500">No available programs at the moment.</p>
				<p class="mt-1 text-sm text-slate-400">Please check back later!</p>
			</div>
		{:else}
			<div class="grid gap-4">
				{#each programs as program}
					<div
						class="rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-md"
					>
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<div class="mb-1 flex flex-wrap items-center gap-2">
									<h3 class="font-semibold text-slate-900">{program.title}</h3>

									<span
										class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
									>
										<CircleCheck class="h-3 w-3" /> Open
									</span>

									<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
										{program.category}
									</span>
								</div>

								<p class="mb-3 text-sm text-slate-500">
									{program.description || 'Walang detalye.'}
								</p>

								<div class="flex flex-wrap gap-4 text-xs text-slate-500">
									<span class="flex items-center gap-1">
										<Users class="h-3.5 w-3.5" />
										Slots:
										<strong class="ml-0.5 text-slate-700">
											{program.slots - program.slots_used} remaining of {program.slots}
										</strong>
									</span>

									<span class="flex items-center gap-1">
										<CalendarDays class="h-3.5 w-3.5" />
										Start:
										<strong class="ml-0.5 text-slate-700">
											{program.start_date
												? new Date(program.start_date).toLocaleDateString()
												: 'N/A'}
										</strong>
									</span>

									<span class="flex items-center gap-1">
										<CalendarDays class="h-3.5 w-3.5" />
										End:
										<strong class="ml-0.5 text-slate-700">
											{program.end_date
												? new Date(program.end_date).toLocaleDateString()
												: 'N/A'}
										</strong>
									</span>
								</div>
{#if program.requirements}
    <div class="mt-2 text-xs text-slate-500">
        <strong>Requirements:</strong>
        <ul class="mt-1 space-y-0.5 list-none">
            {#each program.requirements.split('\n').filter(r => r.trim()) as req}
                <li class="flex items-start gap-1.5">
                    <span>{req.trim()}</span>
                </li>
            {/each}
        </ul>
    </div>
{/if}
							</div>

							<div class="shrink-0">
								{#if $user}
									{#if hasApplied(program.id)}
										<button
											class="flex items-center gap-1.5 rounded-lg bg-slate-400 px-4 py-2 text-sm font-medium whitespace-nowrap text-white opacity-70 cursor-not-allowed"
											disabled
										>
											Applied
										</button>
									{:else if program.slots_used >= program.slots}
										<span
											class="block rounded-lg bg-slate-100 px-3 py-2 text-center text-xs text-slate-400"
										>
											Slots Full
										</span>
									{:else}
										<a
											href="/apply/{program.id}"
											class="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition"
											style="background: #0A1F44;"
											onmouseenter={(e) => (e.currentTarget.style.background = '#0d2756')}
											onmouseleave={(e) => (e.currentTarget.style.background = '#0A1F44')}
										>
											Apply <ChevronRight class="h-4 w-4" />
										</a>
									{/if}
								{:else}
									<a
										href="/login"
										class="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium whitespace-nowrap transition"
										style="color: #0A1F44; border-color: rgba(10,31,68,0.25); background: rgba(10,31,68,0.05);"
										onmouseenter={(e) =>
											(e.currentTarget.style.background = 'rgba(10,31,68,0.10)')}
										onmouseleave={(e) =>
											(e.currentTarget.style.background = 'rgba(10,31,68,0.05)')}
									>
										<LogIn class="h-4 w-4" />
										Login
									</a>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>