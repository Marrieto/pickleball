<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import SetupForm from '$lib/components/SetupForm.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import PlayerRoster from '$lib/components/PlayerRoster.svelte';
	import RoundView from '$lib/components/RoundView.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	let panel = $state<'leaderboard' | 'players'>('leaderboard');
	let modal = $state<HTMLDialogElement>();
	function openPanel(next: typeof panel) {
		panel = next;
		modal?.showModal();
	}
	function closeOnBackdrop(event: MouseEvent) {
		if (!modal || event.target !== modal) return;
		const bounds = modal.getBoundingClientRect();
		if (
			event.clientX < bounds.left || event.clientX > bounds.right ||
			event.clientY < bounds.top || event.clientY > bounds.bottom
		) modal.close();
	}
</script>

{#if !tournamentStore.tournament}
	<SetupForm />
{:else}
	<TopBar />
	<main>
		<div class="column">
			<div class="panel-tools">
				<button onclick={() => openPanel('leaderboard')}>Leaderboard</button>
				<button onclick={() => openPanel('players')}>Players</button>
			</div>
			<RoundView />
		</div>
	</main>
	<dialog bind:this={modal} onclick={closeOnBackdrop} aria-label={panel === 'leaderboard' ? 'Leaderboard' : 'Players'}>
		<div class="modal-header">
			<strong>{panel === 'leaderboard' ? 'Leaderboard' : 'Players'}</strong>
			<button onclick={() => modal?.close()} aria-label="Close panel">Close ✕</button>
		</div>
		{#if panel === 'leaderboard'}
			<Leaderboard />
		{:else}
			<PlayerRoster />
		{/if}
	</dialog>
{/if}

<style>
	main {
		margin: 0 auto;
		padding: 1.25rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.25rem;
	}
	@media (max-width: 1099px) {
		main { padding: 0.75rem; }
	}
	.column {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.panel-tools, .modal-header {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.panel-tools { justify-content: center; flex-wrap: wrap; }
	button {
		padding: 0.65rem 1rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--text);
	}
	dialog {
		width: min(35rem, calc(100% - 1.5rem));
		max-height: 85vh;
		max-height: 85dvh;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
	}
	dialog[open] { animation: panel-enter 180ms ease-out; }
	dialog::backdrop { background: rgb(0 0 0 / 55%); }
	.modal-header { align-items: center; margin-bottom: 1rem; }
	@keyframes panel-enter {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
