<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';

	let standings = $derived(tournamentStore.standings);
</script>

<section class="leaderboard">
	{#if tournamentStore.isFinalized}
		<p class="hint">Standings used to seed the final round. Final games do not change these scores.</p>
	{/if}
	{#if standings.length === 0}
		<p class="hint">Scores will appear here once the first round is played.</p>
	{:else}
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>{tournamentStore.isTeamMode ? 'Team' : 'Player'}</th>
						<th title="Points per game played - this is what decides the standings">Adj</th>
						<th title="Every point won tonight, including any starting handicap">Pts</th>
						<th>Wins</th>
						<th>Games</th>
						<th title="Previous rounds sat out, excluding the round in progress">Sat out</th>
					</tr>
				</thead>
				<tbody>
					{#each standings as s, i (s.id)}
						<tr>
							<td>{i + 1}</td>
							<td>{tournamentStore.displayName(s.id)}</td>
							<td class="primary-score">{s.adjustedScore.toFixed(1)}</td>
							<td>{s.totalPoints}</td>
							<td>{s.wins}</td>
							<td>{s.gamesPlayed}</td>
							<td>{s.timesSatOut}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="hint">
			Adj = points won per game played, and decides the standings — so sitting out more doesn't
			tank your rank. Pts is the running total.
		</p>
	{/if}
</section>

<style>
	.primary-score {
		font-weight: 600;
		color: var(--text);
	}
	.leaderboard {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
		background: var(--surface);
	}
	tbody tr:first-child {
		font-weight: 700;
	}
	/* Keep the name visible while the stat columns scroll sideways on phones. */
	td:nth-child(2),
	th:nth-child(2) {
		position: sticky;
		left: 0;
		background: var(--bg);
	}
	tbody tr:nth-child(odd) td:nth-child(2) {
		background: var(--surface);
	}
	@media (max-width: 600px) {
		th,
		td {
			padding: 0.4rem 0.35rem;
		}
		table {
			font-size: 0.8rem;
		}
	}
</style>
