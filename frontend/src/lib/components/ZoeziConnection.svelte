<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { zoeziApi, ZoeziApiError, type Workout } from '$lib/zoezi/api';
	import type { ZoeziImport } from '$lib/zoezi/import';

	let { enabled = $bindable(false), onpreview, ondisconnect }: {
		enabled?: boolean;
		onpreview: (data: ZoeziImport | null) => void;
		ondisconnect: () => void;
	} = $props();
	let authenticated = $state(false);
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);
	let date = $state(new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit'
	}).format(new Date()));
	let workouts = $state<Workout[]>([]);
	let selected = $state('');
	let revision = 0;
	let controller: AbortController | undefined;

	async function perform<T>(operation: (signal: AbortSignal) => Promise<T>, apply: (result: T) => void) {
		const current = ++revision;
		controller?.abort();
		controller = new AbortController();
		busy = true; error = ''; onpreview(null);
		try {
			const result = await operation(controller.signal);
			if (current === revision) apply(result);
		} catch (e) {
			if (current !== revision) return;
			if (e instanceof ZoeziApiError && e.status === 401) {
				authenticated = false; workouts = []; selected = ''; ondisconnect();
			}
			error = e instanceof ZoeziApiError ? e.message : 'Could not contact Zoezi. Try again.';
		} finally {
			if (current === revision) busy = false;
		}
	}

	function loadWorkouts() {
		workouts = []; selected = '';
		return perform(signal => zoeziApi.workouts(date, signal), result => {
			workouts = result; selected = result.length ? String(result[0].id) : '';
		});
	}
	function login() {
		if (busy || !email.trim() || !password) return;
		const secret = password; password = '';
		void perform(signal => zoeziApi.login(email.trim(), secret, signal), () => {
			authenticated = true; void loadWorkouts();
		});
	}
	function logout() {
		ondisconnect(); workouts = []; selected = '';
		void perform(signal => zoeziApi.logout(signal), () => { authenticated = false; });
	}
	function enterLogin(event: KeyboardEvent) {
		if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); login(); }
	}
	onMount(() => {
		void perform(signal => zoeziApi.status(signal), status => {
			enabled = status.enabled; authenticated = status.authenticated;
			if (authenticated) void loadWorkouts();
		});
	});
	onDestroy(() => { revision++; controller?.abort(); });
</script>

{#if enabled}
	<div class="connection" aria-busy={busy}>
		{#if authenticated}
			<p>Connected to Zoezi <button type="button" class="link" disabled={busy} onclick={logout}>Log out</button></p>
			<label>Session date
				<input type="date" bind:value={date} disabled={busy} onchange={loadWorkouts} />
			</label>
			<button type="button" disabled={busy || !date} onclick={loadWorkouts}>Find sessions</button>
			{#if workouts.length}
				<label>Session
					<select bind:value={selected} disabled={busy} onchange={() => onpreview(null)}>
						{#each workouts as workout (workout.id)}
							<option value={String(workout.id)}>{workout.startTime.slice(11, 16)} — {workout.title}</option>
						{/each}
					</select>
				</label>
				<button type="button" disabled={busy || !selected}
					onclick={() => perform(signal => zoeziApi.participants(Number(selected), signal), onpreview)}>Preview participants</button>
			{:else if !busy && !error}
				<p>No pickleball sessions on this date. Choose another date.</p>
			{/if}
		{:else}
			<p>Log in with your own club Zoezi account to fetch participants.</p>
			<label>Zoezi email or username
				<input type="text" autocomplete="username" autocapitalize="none" spellcheck="false" bind:value={email} disabled={busy} onkeydown={enterLogin} />
			</label>
			<label>Zoezi password
				<input type="password" autocomplete="current-password" bind:value={password} disabled={busy} onkeydown={enterLogin} />
			</label>
			<button type="button" disabled={busy || !email.trim() || !password} onclick={login}>Log in to Zoezi</button>
			<p>Your password is used to log in and is never saved or logged. The connection lasts up to 12 hours.</p>
		{/if}
		{#if busy}<p role="status">Contacting Zoezi…</p>{/if}
	</div>
{/if}
{#if error}<p class="error" role="alert">{error}</p>{/if}

<style>
	.connection { display: grid; gap: 0.75rem; }
	p { margin: 0; font-size: 0.875rem; }
	label { display: grid; gap: 0.3rem; font-size: 0.8rem; }
	input, select, button { box-sizing: border-box; min-width: 0; width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem; background: var(--bg); color: var(--text); font: inherit; }
	button { cursor: pointer; background: var(--primary); color: var(--primary-contrast); font-weight: 600; }
	button:disabled { opacity: 0.5; }
	button.link { width: auto; padding: 0 0.5rem; border: none; background: none; color: var(--primary); text-decoration: underline; }
	.error { color: var(--danger); }
</style>
