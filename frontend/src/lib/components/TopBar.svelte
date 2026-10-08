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
	let formatLabel = $derived(
		tournament.settings.entryMode === 'teams'
			? `Teams · ${tournament.settings.pairingFormat === 'americano' ? 'Rotation' : 'Rank'}`
			: tournament.settings.pairingFormat === 'americano'
				? 'Americano'
				: 'Mexicano'
	);

	function endTournament() {
		if (confirm('End this tournament? Rounds and scores are cleared. Player names are kept for next time.')) {
			tournamentStore.endTournament();
		}
	}
</script>

<header class="topbar">
	<div class="title">
		<img class="logo" src={icon} alt="" />
		<div class="text">
			<h1>{tournament.name}</h1>
			<span class="meta">{tournament.courtCount} courts · {scoreLabel} · {formatLabel}</span>
		</div>
	</div>
	<div class="actions">
		{#if tournament.lastAction}
			<button
				class="ghost"
				onclick={() => tournamentStore.undo()}
				title="Undo last action"
				aria-label="Undo last action"
			>
				↶<span class="undo-label"> Undo</span>
			</button>
		{/if}
		<ThemeToggle />
		<button class="ghost danger" onclick={endTournament}>End</button>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem max(1.25rem, env(safe-area-inset-right)) 0.75rem
			max(1.25rem, env(safe-area-inset-left));
		padding-top: calc(0.75rem + env(safe-area-inset-top));
		background: var(--header-bg);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.title {
		min-width: 0;
		flex: 1 1 auto;
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
	.text { min-width: 0; }
	h1 {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1.15rem;
		color: var(--header-text);
	}
	.meta {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8rem;
		color: var(--header-text-muted);
	}
	.actions {
		flex-shrink: 0;
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
	@media (max-width: 600px) {
		.topbar {
			gap: 0.5rem;
			padding: 0.5rem max(0.75rem, env(safe-area-inset-right)) 0.5rem
				max(0.75rem, env(safe-area-inset-left));
			padding-top: calc(0.5rem + env(safe-area-inset-top));
		}
		.title { gap: 0.5rem; }
		.logo { width: 1.75rem; height: 1.75rem; }
		h1 { font-size: 1rem; }
		.meta { font-size: 0.7rem; }
		.actions { gap: 0.35rem; }
		button.ghost { padding: 0.4rem 0.6rem; }
		.undo-label { display: none; }
	}
</style>
