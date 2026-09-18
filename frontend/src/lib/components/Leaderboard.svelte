<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';

	let tournament = $derived(tournamentStore.tournament!);
	let standings = $derived(tournamentStore.standings);

	function playerName(id: string): string {
		return tournament.players.find((p) => p.id === id)?.name ?? '?';
	}
</script>

<section class="card leaderboard">
	<h2>Leaderboard</h2>
	{#if standings.length === 0}
		<p class="hint">Scores will appear here once the first round is played.</p>
	{:else}
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Player</th>
						<th>Pts</th>
						<th title="Points per game played - fair to compare across players who've sat out more">
							Adj
						</th>
						<th>Wins</th>
						<th>Games</th>
						<th title="Rounds sat out so far">Sat out</th>
					</tr>
				</thead>
				<tbody>
					{#each standings as s, i (s.id)}
						<tr>
							<td>{i + 1}</td>
							<td>{playerName(s.id)}</td>
							<td>{s.totalPoints}</td>
							<td>{s.adjustedScore.toFixed(1)}</td>
							<td>{s.wins}</td>
							<td>{s.gamesPlayed}</td>
							<td>{s.timesSatOut}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="hint">Adj = points per game played, so sitting out more doesn't tank your rank.</p>
	{/if}
</section>

<style>
	.leaderboard {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	h2 {
		font-size: 1rem;
	}
	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.table-scroll {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.4rem 0.5rem;
		white-space: nowrap;
	}
	th {
		color: var(--text-muted);
		font-weight: 500;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	tbody tr:nth-child(odd) {
		background: var(--bg);
	}
	tbody tr:first-child {
		font-weight: 700;
	}
</style>
