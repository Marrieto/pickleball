<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import type { CourtMatch } from '$lib/types';

	let {
		match,
		roundId,
		maxScore,
		playerName
	}: {
		match: CourtMatch;
		roundId: string;
		maxScore: number;
		playerName: (id: string) => string;
	} = $props();

	let scoreA = $state(match.score?.teamAPoints ?? 0);
	let scoreB = $state(match.score?.teamBPoints ?? 0);

	function submit() {
		tournamentStore.recordScore(roundId, match.court, scoreA, scoreB);
	}
</script>

<div class="card match">
	<div class="court-label">Court {match.court}</div>

	<div class="team" class:winner={match.score && scoreA > scoreB}>
		<span class="players">{playerName(match.teamA[0])} &amp; {playerName(match.teamA[1])}</span>
		<input type="number" min="0" max={maxScore} bind:value={scoreA} onchange={submit} />
	</div>

	<div class="divider">vs</div>

	<div class="team" class:winner={match.score && scoreB > scoreA}>
		<span class="players">{playerName(match.teamB[0])} &amp; {playerName(match.teamB[1])}</span>
		<input type="number" min="0" max={maxScore} bind:value={scoreB} onchange={submit} />
	</div>
</div>

<style>
	.match {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.court-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.team {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border: 1px solid var(--border);
		background: var(--bg);
		border-radius: 10px;
		padding: 0.65rem 0.85rem;
		color: var(--text);
	}
	.team.winner {
		border-color: var(--primary);
		background: color-mix(in srgb, var(--primary) 14%, var(--surface));
	}
	.players {
		font-weight: 500;
	}
	.team input {
		width: 3.5rem;
		padding: 0.35rem 0.5rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		text-align: center;
		font-size: 1.1rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.divider {
		text-align: center;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
</style>
