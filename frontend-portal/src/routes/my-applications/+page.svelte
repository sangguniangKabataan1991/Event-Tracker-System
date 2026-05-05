<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { apiFetch, user } from '$lib/api.js';
	import {
		ArrowLeft,
		Inbox,
		Clock,
		CheckCircle2,
		XCircle,
		ListOrdered,
		AlertCircle,
		StickyNote
	} from 'lucide-svelte';

	type AppStatus = 'pending' | 'approved' | 'rejected' | 'waitlist';

	interface Application {
		program_title: string;
		program_category: string;
		full_name: string;
		age: number;
		contact: string;
		barangay: string;
		created_at: string;
		notes?: string;
		status: AppStatus;
	}

	let applications = $state<Application[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		if (!$user) {
			goto('/login');
			return;
		}
		try {
			applications = await apiFetch('/applications/my');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Error';
		} finally {
			loading = false;
		}
	});

	const statusBadge: Record<AppStatus, string> = {
		pending: 'bg-amber-50 text-amber-700 border border-amber-200',
		approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
		rejected: 'bg-red-50 text-red-700 border border-red-200',
		waitlist: 'bg-slate-100 text-slate-600 border border-slate-200'
	};

	const statusLabel: Record<AppStatus, string> = {
		pending: 'Awaiting review',
		approved: 'You are beneficiary!',
		rejected: 'Application not accepted',
		waitlist: 'Waiting for an available slot'
	};
</script>

<div class="space-y-5">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
		<div>
			<h1 class="text-xl sm:text-2xl font-bold text-slate-900">My Applications</h1>
			<p class="text-sm text-slate-500">Status of all your applications</p>
		</div>
		<a
			href="/"
			class="self-start sm:self-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-slate-300"
		>
			<ArrowLeft class="h-4 w-4" />
			Programs
		</a>
	</div>

	{#if loading}
		<div class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
			<div
				class="h-5 w-5 animate-spin rounded-full border-2 border-slate-200"
				style="border-top-color: #0A1F44;"
			></div>
			Loading...
		</div>
	{:else if error}
		<div class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
			<AlertCircle class="h-4 w-4 shrink-0" />
			{error}
		</div>
	{:else if applications.length === 0}
		<div class="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
			<Inbox class="mx-auto mb-3 h-10 w-10 text-slate-300" />
			<p class="font-medium text-slate-500">You don't have any applications yet</p>
			<p class="mt-1 mb-5 text-sm text-slate-400">Apply to an available program!</p>
			<a
				href="/"
				class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition"
				style="background: #0A1F44;"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.background = '#0d2756')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.background = '#0A1F44')}
			>
				View Programs
			</a>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each applications as app}
				<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
					<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
						<div class="min-w-0 flex-1">
							<h3 class="font-semibold text-slate-900">{app.program_title}</h3>
							<p class="mb-3 text-xs text-slate-400">{app.program_category}</p>

							<div class="mb-3 grid grid-cols-1 xs:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600">
								<div>
									<span class="text-xs text-slate-400">Full Name</span><br />{app.full_name}
								</div>
								<div><span class="text-xs text-slate-400">Age</span><br />{app.age}</div>
								<div><span class="text-xs text-slate-400">Contact</span><br />{app.contact}</div>
								<div>
									<span class="text-xs text-slate-400">Barangay</span><br />{app.barangay || '—'}
								</div>
							</div>

							<div class="text-xs text-slate-400">
								Submitted: {new Date(app.created_at).toLocaleDateString('fil-PH', {
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})}
							</div>

							{#if app.notes}
								<div class="mt-3 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
									<StickyNote class="mt-0.5 h-3.5 w-3.5 shrink-0" />
									<span><strong>SK note:</strong> {app.notes}</span>
								</div>
							{/if}
						</div>

						<!-- Status Badge -->
						<div class="flex sm:flex-col items-start sm:items-end gap-2 sm:gap-0 sm:text-right shrink-0">
							<span
								class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium {statusBadge[app.status]}"
							>
								{#if app.status === 'pending'}
									<Clock class="h-3.5 w-3.5" />
								{:else if app.status === 'approved'}
									<CheckCircle2 class="h-3.5 w-3.5" />
								{:else if app.status === 'rejected'}
									<XCircle class="h-3.5 w-3.5" />
								{:else if app.status === 'waitlist'}
									<ListOrdered class="h-3.5 w-3.5" />
								{/if}
								{app.status.charAt(0).toUpperCase() + app.status.slice(1)}
							</span>
							<p class="sm:mt-1.5 text-xs leading-tight text-slate-400 sm:max-w-32">
								{statusLabel[app.status]}
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>