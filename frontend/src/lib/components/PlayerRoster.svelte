<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';

	let tournament = $derived(tournamentStore.tournament!);
	let activePlayers = $derived(tournament.players.filter((p) => p.active));
	let newName = $state('');

	function add(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = newName.trim();
		if (!trimmed) return;
		tournamentStore.addPlayer(trimmed);
		newName = '';
	}
</script>

<section class="card roster">
	<h2>Players ({activePlayers.length})</h2>

	<form onsubmit={add} class="add-row">
		<input placeholder="Add player name" bind:value={newName} />
		<button type="submit">Add</button>
	</form>

	<ul>
		{#each activePlayers as player (player.id)}
			<li>
				<span class="name">{player.name}</span>
				<label class="bench">
					<input
						type="checkbox"
						checked={tournament.pendingBenchIds.includes(player.id)}
						onchange={() => tournamentStore.togglePendingBench(player.id)}
					/>
					sitting out next round
				</label>
				<button
					class="remove"
					onclick={() => tournamentStore.removePlayer(player.id)}
					aria-label="Remove {player.name}"
				>
					✕
				</button>
			</li>
		{:else}
			<li class="empty">No players yet — add at least 4 to start a round.</li>
		{/each}
	</ul>
</section>

<style>
	.roster {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	h2 {
		font-size: 1rem;
	}
	.add-row {
		display: flex;
		gap: 0.5rem;
	}
	.add-row input {
		flex: 1;
		padding: 0.55rem 0.7rem;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--text);
	}
	.add-row button {
		padding: 0.55rem 1rem;
		border-radius: 10px;
		border: none;
		background: var(--primary);
		color: var(--primary-contrast);
		font-weight: 600;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.6rem;
		border-radius: 10px;
		background: var(--bg);
	}
	li.empty {
		color: var(--text-muted);
		font-size: 0.875rem;
		justify-content: center;
	}
	.name {
		font-weight: 500;
		flex: 1;
	}
	.bench {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.remove {
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 1rem;
		line-height: 1;
		padding: 0.25rem;
	}
	.remove:hover {
		color: var(--danger);
	}
</style>
