<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';

	let tournament = $derived(tournamentStore.tournament!);
	let teams = $derived(tournamentStore.teams);
	let unassigned = $derived(tournamentStore.unassignedPlayers);
	let validation = $derived(tournamentStore.teamValidation);
	let gameInProgress = $derived(tournament.roundIds.length > 0);

	let selected = $state<string | null>(null);

	function suggestedStartingPoints(): number {
		const standings = tournamentStore.standings;
		return standings.length === 0 ? 0 : Math.min(...standings.map((s) => s.totalPoints));
	}

	// Two-tap pairing: tap one player, tap a second to team them up. Same gesture as
	// editing matchups in the round view, and far easier on a phone than two dropdowns.
	function pick(id: string) {
		if (selected === id) {
			selected = null;
			return;
		}
		if (!selected) {
			selected = id;
			return;
		}
		tournamentStore.createTeam(selected, id, {
			startingPoints: gameInProgress ? suggestedStartingPoints() : 0
		});
		selected = null;
	}

	function playerName(id: string): string {
		return tournament.players.find((p) => p.id === id)?.name ?? '?';
	}
</script>

<section class="card roster">
	<h2>Teams ({teams.length})</h2>

	{#if !validation.ok && !tournamentStore.isFinalized}
		<p class="warning">
			{#if unassigned.length > 0}
				{unassigned.map((p) => p.name).join(', ')}
				{unassigned.length === 1 ? 'has' : 'have'} no partner — pair or remove
				{unassigned.length === 1 ? 'them' : 'everyone'} to generate a round.
			{:else if validation.playableTeamCount < 2}
				At least two teams are needed to play a round.
			{:else}
				Teams need fixing before a round can be generated.
			{/if}
		</p>
	{/if}

	<ul>
		{#each teams as team (team.id)}
			<li>
				<span class="name">{tournamentStore.displayName(team.id)}</span>
				{#if !tournamentStore.isFinalized}
					<label class="bench">
						<input
							type="checkbox"
							checked={tournament.pendingBenchIds.includes(team.id)}
							onchange={() => tournamentStore.togglePendingBench(team.id)}
						/>
						sitting out next round
					</label>
					<button
						class="remove"
						onclick={() => tournamentStore.disbandTeam(team.id)}
						aria-label="Disband {tournamentStore.displayName(team.id)}"
					>
						✕
					</button>
				{/if}
			</li>
		{:else}
			<li class="empty">No teams yet — tap two players below to pair them.</li>
		{/each}
	</ul>

	{#if unassigned.length > 0 && !tournamentStore.isFinalized}
		<div class="unpaired">
			<h3>Not yet paired</h3>
			<p class="hint">
				{selected ? `Tap a partner for ${playerName(selected)}.` : 'Tap two players to pair them.'}
			</p>
			<ul class="chips">
				{#each unassigned as player (player.id)}
					<li>
						<button
							class="chip"
							class:selected={selected === player.id}
							onclick={() => pick(player.id)}
						>
							{player.name}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
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
	.warning {
		margin: 0;
		padding: 0.6rem 0.7rem;
		border-radius: 10px;
		border: 1px solid var(--danger);
		color: var(--danger);
		font-size: 0.8rem;
	}
	.hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
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
		min-width: 0;
		overflow-wrap: anywhere;
		font-weight: 500;
		flex: 1;
	}
	.bench {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--text-muted);
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
	.unpaired {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		border-top: 1px solid var(--border);
		padding-top: 0.9rem;
	}
	.unpaired h3 {
		margin: 0;
		font-size: 0.875rem;
	}
	ul.chips {
		flex-direction: row;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	ul.chips li {
		padding: 0;
		background: transparent;
	}
	.chip {
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg);
		color: var(--text);
		font-size: 0.875rem;
	}
	.chip.selected {
		border-color: var(--primary);
		background: var(--primary);
		color: var(--primary-contrast);
		font-weight: 600;
	}
</style>
