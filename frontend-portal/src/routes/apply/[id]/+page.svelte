<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { apiFetch, user, token, API } from '$lib/api.js';
	import {
		ClipboardList,
		Users,
		ArrowLeft,
		CheckCircle2,
		AlertCircle,
		Loader2,
		FileText,
		ImageIcon,
		Paperclip,
		X
	} from 'lucide-svelte';

	interface Program {
		title: string;
		category: string;
		slots: number;
		slots_used: number;
	}

	let program    = $state<Program | null>(null);
	let loading    = $state(true);
	let submitting = $state(false);
	let error      = $state('');
	let success    = $state(false);
	let attachedFiles = $state<File[]>([]);

	let showConfirm = $state(false);

	let form = $state({
		full_name:               '',
		address:                 '',
		age:                     '',
		contact:                 '',
		barangay:                '',
		requirements_submitted:  ''
	});

	let requirementsValid = $derived(
		form.requirements_submitted.trim().length > 0 || attachedFiles.length > 0
	);

	onMount(async () => {
		if (!$user) {
			goto('/login');
			return;
		}
		try {
			program = await apiFetch(`/programs/${page.params.id}`);

			form.full_name = $user?.full_name ?? '';
			form.contact = $user?.contact ?? '';
			form.barangay = $user?.barangay ?? '';
			form.address = $user?.address ?? '';

		} catch (e) {
			error = e instanceof Error ? e.message : 'Error loading program';
		} finally {
			loading = false;
		}
	});

	function handleContactInput(e: Event) {
		const input  = e.currentTarget as HTMLInputElement;
		input.value  = input.value.replace(/\D/g, '').slice(0, 11);
		form.contact = input.value;
	}

	function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (input.files) {
			attachedFiles = [...attachedFiles, ...Array.from(input.files)];
			input.value   = '';
		}
	}

	function removeFile(index: number) {
		attachedFiles = attachedFiles.filter((_, i) => i !== index);
	}

	function formatFileSize(bytes: number) {
		if (bytes < 1024)            return bytes + ' B';
		if (bytes < 1024 * 1024)     return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function isImage(file: File) {
		return file.type.startsWith('image/');
	}

	function openConfirm() {
		error = '';

		if (!form.full_name.trim())  { error = 'Full name is required.'; return; }
		if (!form.address.trim())    { error = 'Address is required.'; return; }
		if (!form.barangay.trim())   { error = 'Barangay is required.'; return; }
		if (!form.age)               { error = 'Age is required.'; return; }
		if (!form.contact.trim())    { error = 'Contact number is required.'; return; }

		if (!form.requirements_submitted.trim() && attachedFiles.length === 0) {
			error = 'Please provide requirements — enter text or attach at least one file.';
			return;
		}

		showConfirm = true;
	}

	async function submitApplication() {
		error = '';
		submitting = true;

		try {
			// Step 1: Submit application data — get back the new application ID
			const result = await apiFetch('/applications', {
				method: 'POST',
				body: {
					program_id:              page.params.id,
					full_name:               form.full_name,
					address:                 form.address,
					age:                     parseInt(form.age),
					contact:                 form.contact,
					barangay:                form.barangay,
					requirements_submitted:  form.requirements_submitted
				}
			});

			// Step 2: Upload attached files using the returned application ID
			if (attachedFiles.length > 0) {
				const t  = get(token);
				const fd = new FormData();
				for (const file of attachedFiles) {
					fd.append('files', file);
				}

				// Do NOT manually set Content-Type — browser adds multipart boundary automatically
				const res = await fetch(`${API}/applications/${result.id}/requirements`, {
					method:  'POST',
					headers: t ? { Authorization: `Bearer ${t}` } : {},
					body:    fd
				});

				if (!res.ok) {
					const err = await res.json().catch(() => ({ error: 'Upload failed' }));
					throw new Error(err.error || 'File upload failed');
				}
			}

			success = true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Submission failed. Please try again.';
		} finally {
			submitting = false;
			showConfirm = false;
		}
	}
</script>

<div class="mx-auto max-w-lg">
	{#if loading}
		<div class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
			<div
				class="h-5 w-5 animate-spin rounded-full border-2 border-slate-200"
				style="border-top-color: #0A1F44;"
			></div>
			Loading...
		</div>

	{:else if success}
		<div class="rounded-2xl border border-slate-200 bg-white px-6 sm:px-8 py-12 sm:py-14 text-center shadow-sm">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-emerald-100 p-4">
					<CheckCircle2 class="h-10 w-10 text-emerald-600" />
				</div>
			</div>
			<h2 class="mb-2 text-xl font-bold text-slate-900">Application Submitted!</h2>
			<p class="mx-auto mb-6 max-w-xs text-sm text-slate-500">
				Your application has been successfully submitted. You can check the status in the
				"My Applications" section. Thank you for applying!
			</p>
			<div class="flex flex-col sm:flex-row justify-center gap-3">
				<a
					href="/my-applications"
					class="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition text-center"
					style="background: #0A1F44;"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.background = '#0d2756')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.background = '#0A1F44')}
				>
					View My Applications
				</a>
				<a
					href="/"
					class="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-800 text-center"
				>
					Back to Home
				</a>
			</div>
		</div>

	{:else}
		{#if program}
			<div
				class="mb-5 rounded-xl border p-4"
				style="background: rgba(10,31,68,0.05); border-color: rgba(10,31,68,0.15);"
			>
				<div class="flex items-start gap-3">
					<div
						class="shrink-0 rounded-lg p-2"
						style="background: rgba(10,31,68,0.10); color: #0A1F44;"
					>
						<ClipboardList class="h-5 w-5" />
					</div>
					<div>
						<h2 class="font-bold" style="color: #0A1F44;">{program.title}</h2>
						<p class="text-sm" style="color: rgba(10,31,68,0.70);">{program.category}</p>
						<p class="mt-1 flex items-center gap-1 text-xs" style="color: rgba(10,31,68,0.55);">
							<Users class="h-3.5 w-3.5" />
							{program.slots - program.slots_used} slots remaining of {program.slots} total
						</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
			<h1 class="mb-1 text-lg font-bold text-slate-900">Application Form</h1>
			<p class="mb-5 text-sm text-slate-500">
				Please fill out all fields correctly and completely.
			</p>

			<form onsubmit={(e) => { e.preventDefault(); openConfirm(); }} class="space-y-4">
				<div>
					<label class="label" for="fn">Full Name *</label>
					<input id="fn" bind:value={form.full_name} class="input" required />
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="label" for="age">Age *</label>
						<input
							id="age"
							bind:value={form.age}
							type="number"
							class="input"
							required
							min="1"
							max="30"
						/>
					</div>
					<div>
						<label class="label" for="contact">Contact Number *</label>
						<input
							id="contact"
							bind:value={form.contact}
							class="input"
							required
							inputmode="numeric"
							maxlength="11"
							oninput={handleContactInput}
						/>
					</div>
				</div>

				<div>
					<label class="label" for="barangay">Barangay *</label>
					<input id="barangay" bind:value={form.barangay} class="input" required />
				</div>

				<div>
					<label class="label" for="address">Complete Address *</label>
					<input id="address" bind:value={form.address} class="input" required />
				</div>

				<div>
					<label class="label" for="req">Requirements *</label>

					<div
						class="overflow-hidden rounded-lg border transition focus-within:border-slate-400"
						class:border-slate-200={!error || requirementsValid}
						class:border-red-300={!!error && !requirementsValid}
					>
						<!-- Text area for listing requirements -->
						<textarea
							id="req"
							bind:value={form.requirements_submitted}
							rows={3}
							class="w-full resize-none border-none px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
						></textarea>

						<div class="border-t border-slate-100"></div>

						{#if attachedFiles.length > 0}
							<ul class="flex flex-col gap-1 px-3 py-2">
								{#each attachedFiles as file, i}
									<li
										class="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5"
									>
										<div class="flex min-w-0 items-center gap-2">
											{#if isImage(file)}
												<ImageIcon size={13} class="shrink-0 text-slate-400" />
											{:else}
												<FileText size={13} class="shrink-0 text-slate-400" />
											{/if}
											<span class="truncate text-xs text-slate-700">{file.name}</span>
											<span class="shrink-0 text-xs text-slate-400">{formatFileSize(file.size)}</span>
										</div>
										<button
											type="button"
											onclick={() => removeFile(i)}
											class="ml-2 shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
										>
											<X size={12} />
										</button>
									</li>
								{/each}
							</ul>
							<div class="border-t border-slate-100"></div>
						{/if}

						<div class="flex items-center px-3 py-2">
							<label
								class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-600"
							>
								<Paperclip size={13} />
								Attach file or image
								<input
									type="file"
									multiple
									accept="image/*,.pdf"
									class="hidden"
									onchange={handleFileChange}
								/>
							</label>
							<span class="ml-auto text-xs text-slate-300">PNG, JPG, PDF · max 10MB each</span>
						</div>
					</div>
				</div>

				<!-- Error message -->
				{#if error}
					<div
						class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
					>
						<AlertCircle class="h-4 w-4 shrink-0" />
						{error}
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex flex-col-reverse sm:flex-row gap-3 pt-1">
					<a
						href="/"
						class="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:border-slate-300"
					>
						<ArrowLeft class="h-4 w-4" />
						Back
					</a>
					<button
						type="submit"
						disabled={submitting}
						class="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
						style="background: #0A1F44;"
						onmouseenter={(e) => {
							if (!(e.currentTarget as HTMLButtonElement).disabled)
								(e.currentTarget as HTMLElement).style.background = '#0d2756';
						}}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.background = '#0A1F44')}
					>
						Submit Application
					</button>

					<a
						href="/"
						class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:border-slate-300"
					>
						<ArrowLeft class="h-4 w-4" />
						Back
					</a>
				</div>
			</form>
		</div>

		{#if showConfirm}
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(10,31,68,0.5);">
				<div class="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200">
					<div class="px-6 py-5 border-b border-slate-100">
						<h2 class="text-base font-bold text-slate-900">Confirm Submission</h2>
						<p class="text-xs text-slate-400 mt-1">
							Please confirm before submitting your application.
						</p>
					</div>

					<div class="px-6 py-5 space-y-2 text-sm text-slate-600">
						<div><span class="text-slate-400 text-xs">Full Name</span><br />{form.full_name}</div>
						<div><span class="text-slate-400 text-xs">Age</span><br />{form.age}</div>
						<div><span class="text-slate-400 text-xs">Contact</span><br />{form.contact}</div>
						<div><span class="text-slate-400 text-xs">Barangay</span><br />{form.barangay}</div>
						<div><span class="text-slate-400 text-xs">Address</span><br />{form.address}</div>
					</div>

					<div class="px-6 pb-5 flex gap-2">
						<button
							type="button"
							onclick={() => submitApplication()}
							class="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
							style="background: #0A1F44;"
							disabled={submitting}
						>
							{#if submitting}
								<Loader2 class="h-4 w-4 animate-spin inline-block mr-1" />
								Submitting...
							{:else}
								Confirm
							{/if}
						</button>

						<button
							type="button"
							onclick={() => showConfirm = false}
							class="flex-1 rounded-xl py-2.5 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
							disabled={submitting}
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>