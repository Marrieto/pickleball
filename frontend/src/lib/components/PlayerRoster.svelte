<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';

	let tournament = $derived(tournamentStore.tournament!);
	let activePlayers = $derived(tournament.players.filter((p) => p.active));
	let gameInProgress = $derived(tournament.roundIds.length > 0);
	let newName = $state('');
	let pendingName = $state<string | null>(null);
	let startingPoints = $state(0);

	function suggestedStartingPoints(): number {
		const standings = tournamentStore.standings;
		return standings.length === 0 ? 0 : Math.min(...standings.map((s) => s.totalPoints));
	}

	function add(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = newName.trim();
		if (!trimmed) return;
		if (gameInProgress) {
			pendingName = trimmed;
			startingPoints = suggestedStartingPoints();
			return;
		}
		tournamentStore.addPlayer(trimmed);
		newName = '';
	}

	function confirmAdd() {
		if (pendingName === null) return;
		tournamentStore.addPlayer(pendingName, startingPoints);
		pendingName = null;
		newName = '';
	}

	function cancelAdd() {
		pendingName = null;
	}
</script>

<section class="card roster">
	<h2>Players ({activePlayers.length})</h2>

	<form onsubmit={add} class="add-row">
		<input placeholder="Add player name" bind:value={newName} />
		<button type="submit">Add</button>
	</form>

	{#if pendingName !== null}
		<button class="backdrop" aria-label="Close" onclick={cancelAdd}></button>
		<div class="card add-modal" role="dialog" aria-label="Starting points for {pendingName}">
			<p class="add-modal-title">Add {pendingName}</p>
			<p class="hint">Game's in progress - pick a starting score.</p>
			<label class="starting-points">
				Starting points
				<input type="number" min="0" bind:value={startingPoints} />
			</label>
			<div class="add-confirm-actions">
				<button onclick={cancelAdd}>Cancel</button>
				<button class="primary" onclick={confirmAdd}>Add</button>
			</div>
		</div>
	{/if}

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
	.backdrop {
		position: fixed;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.5);
		z-index: 20;
	}
	.add-modal {
		position: fixed;
		inset: auto 5vw auto 5vw;
		top: 50%;
		transform: translateY(-50%);
		max-width: 360px;
		margin: 0 auto;
		z-index: 21;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.add-modal-title {
		margin: 0;
		font-weight: 600;
	}
	.hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.starting-points {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.starting-points input {
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
	}
	.add-confirm-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	.add-confirm-actions button {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
	}
	.add-confirm-actions button.primary {
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
