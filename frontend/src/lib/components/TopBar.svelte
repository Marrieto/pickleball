<script lang="ts">
	import icon from '$lib/assets/favicon.svg';
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let tournament = $derived(tournamentStore.tournament!);
	let scoreLabel = $derived(
		tournament.settings.scoringMode === 'bestOf'
			? `best of ${tournament.targetScore}`
			: `first to ${tournament.targetScore}`
	);
	let formatLabel = $derived(tournament.settings.pairingFormat === 'americano' ? 'Americano' : 'Mexicano');

	function endTournament() {
		if (confirm('End this tournament? This clears it from this device.')) {
			tournamentStore.endTournament();
		}
	}
</script>

<header class="topbar">
	<div class="title">
		<img class="logo" src={icon} alt="" />
		<div>
			<h1>{tournament.name}</h1>
			<span class="meta">{tournament.courtCount} courts · {scoreLabel} · {formatLabel}</span>
		</div>
	</div>
	<div class="actions">
		{#if tournament.lastAction}
			<button class="ghost" onclick={() => tournamentStore.undo()} title="Undo last action">
				↶ Undo
			</button>
		{/if}
		<ThemeToggle />
		<button class="ghost danger" onclick={endTournament}>End</button>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: var(--header-bg);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.title {
		min-width: 0;
		flex: 1 1 14rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.logo {
		width: 2rem;
		height: 2rem;
		border-radius: 8px;
		flex-shrink: 0;
	}
	.title > div { min-width: 0; }
	h1 {
		overflow-wrap: anywhere;
		font-size: 1.15rem;
		color: var(--header-text);
	}
	.meta {
		display: block;
		font-size: 0.8rem;
		color: var(--header-text-muted);
	}
	.actions {
		flex-wrap: wrap;
		display: flex;
		gap: 0.5rem;
		color: var(--header-text);
	}
	button.ghost {
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: transparent;
		color: var(--header-text);
		border-radius: 10px;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}
	button.ghost.danger {
		color: var(--danger);
		border-color: var(--danger);
	}
</style>
