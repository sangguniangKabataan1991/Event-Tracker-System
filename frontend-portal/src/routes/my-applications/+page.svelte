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
		StickyNote,
		Ban
	} from 'lucide-svelte';

	type AppStatus = 'pending' | 'approved' | 'rejected' | 'waitlist';

	interface Application {
		id?: string | number;
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
	let loading      = $state(true);
	let error        = $state('');

	let lastStatuses = $state<Record<string, AppStatus>>({});
	let toastMessage = $state('');
	let toastType = $state<'success' | 'info' | 'error'>('info');
	let toastVisible = $state(false);

	function showToast(message: string, type: 'success' | 'info' | 'error' = 'info') {
		toastMessage = message;
		toastType = type;
		toastVisible = true;
		setTimeout(() => {
			toastVisible = false;
		}, 3000);
	}

	function getKey(app: Application, index: number) {
		if (app.id !== undefined && app.id !== null) return String(app.id);
		return `${app.program_title}-${app.created_at}-${index}`;
	}

	async function loadApplications(initial = false) {
		try {
			const data: Application[] = await apiFetch('/applications/my');
			applications = data;

			if (initial) {
				const map: Record<string, AppStatus> = {};
				data.forEach((app, i) => {
					map[getKey(app, i)] = app.status;
				});
				lastStatuses = map;
				return;
			}

			data.forEach((app, i) => {
				const key = getKey(app, i);
				const prev = lastStatuses[key];

				if (prev && prev !== app.status) {
					if (app.status === 'approved') {
						showToast(`Your application for "${app.program_title}" was approved!`, 'success');
					} else if (app.status === 'rejected') {
						showToast(`Your application for "${app.program_title}" was rejected.`, 'error');
					} else if (app.status === 'waitlist') {
						showToast(`Your application for "${app.program_title}" is now waitlisted.`, 'info');
					} else {
						showToast(`Your application for "${app.program_title}" status changed.`, 'info');
					}
				}

				lastStatuses[key] = app.status;
			});
		} catch (e) {
			error = e instanceof Error ? e.message : 'Error';
		}
	}

	onMount(() => {
		if (!$user) {
			goto('/login');
			return;
		}

		loading = true;
		loadApplications(true).then(() => {
			loading = false;
		});

		const params = new URLSearchParams(window.location.search);
		if (params.get('submitted') === '1') {
			showToast('Application submitted successfully!', 'success');
			window.history.replaceState({}, '', window.location.pathname);
		}

		const interval = setInterval(() => {
			loadApplications(false);
		}, 7000);

		return () => clearInterval(interval);
	});

	const statusBadge: Record<AppStatus, string> = {
		pending:  'bg-amber-50 text-amber-700 border border-amber-200',
		approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
		rejected: 'bg-red-50 text-red-700 border border-red-200',
		waitlist: 'bg-slate-100 text-slate-600 border border-slate-200',
	};

</script>

<div class="space-y-5">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-900">My Applications</h1>
			<p class="text-sm text-slate-500">History of all your applications</p>
		</div>
		<a href="/"
			class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-slate-300">
			<ArrowLeft class="h-4 w-4" />
			Programs
		</a>
	</div>

	{#if toastVisible}
		<div class="fixed right-5 top-5 z-50">
			<div
				class="rounded-xl border px-4 py-3 text-sm shadow-lg"
				class:border-emerald-200={toastType === 'success'}
				class:bg-emerald-50={toastType === 'success'}
				class:text-emerald-700={toastType === 'success'}
				class:border-red-200={toastType === 'error'}
				class:bg-red-50={toastType === 'error'}
				class:text-red-700={toastType === 'error'}
				class:border-slate-200={toastType === 'info'}
				class:bg-white={toastType === 'info'}
				class:text-slate-700={toastType === 'info'}
			>
				{toastMessage}
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
			<div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-200"
				style="border-top-color: #0A1F44;"></div>
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
			<a href="/"
				class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition"
				style="background: #0A1F44;"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.background = '#0d2756')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.background = '#0A1F44')}>
				View Programs
			</a>
		</div>

	{:else}
		<div class="grid gap-4">
			{#each applications as app, i}
				<div
					class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
				>
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0 flex-1">
							<h3 class="font-semibold text-slate-900">{app.program_title}</h3>
							<p class="mb-3 text-xs text-slate-400">{app.program_category}</p>

							<div class="mb-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600">
								<div>
									<span class="text-xs text-slate-400">Full Name</span><br />{app.full_name}
								</div>
								<div>
									<span class="text-xs text-slate-400">Age</span><br />{app.age}
								</div>
								<div>
									<span class="text-xs text-slate-400">Contact</span><br />{app.contact}
								</div>
								<div>
									<span class="text-xs text-slate-400">Barangay</span><br />{app.barangay || '—'}
								</div>
							</div>

							<div class="text-xs text-slate-400">
								Submitted: {new Date(app.created_at).toLocaleDateString('en-US', {
									year: 'numeric', month: 'long', day: 'numeric'
								})}
							</div>

							<!-- SK general note (non-rejection) -->
							{#if app.notes && app.status !== 'rejected'}
								<div class="mt-3 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
									<StickyNote class="mt-0.5 h-3.5 w-3.5 shrink-0" />
									<span><strong>SK note:</strong> {app.notes}</span>
								</div>
							{/if}

							<!-- Rejection reason — prominently shown -->
							{#if app.status === 'rejected'}
								<div class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
									<div class="flex items-center gap-1.5 mb-1">
										<Ban class="h-3.5 w-3.5 text-red-500 shrink-0" />
										<span class="text-xs font-semibold text-red-600 uppercase tracking-wide">Reason for Rejection</span>
									</div>
									{#if app.notes}
										<p class="text-sm text-slate-700">{app.notes}</p>
									{:else}
										<p class="text-xs text-slate-400 italic">No reason was provided. Please contact your SK office for more information.</p>
									{/if}
								</div>
							{/if}
						</div>

						<div class="shrink-0 text-right">
							<span class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium {statusBadge[app.status]}">
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
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>