<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import CourtBackdrop from './CourtBackdrop.svelte';
	import NetZone from './NetZone.svelte';
	import type { CourtMatch, CourtSideLabels } from '$lib/types';

	let {
		match,
		roundId,
		maxScore,
		playerName,
		sideLabels
	}: {
		match: CourtMatch;
		roundId: string;
		maxScore: number;
		playerName: (id: string) => string;
		sideLabels: CourtSideLabels;
	} = $props();

	let scoreA = $state(match.score?.teamAPoints ?? 0);
	let scoreB = $state(match.score?.teamBPoints ?? 0);

	function submit() {
		tournamentStore.recordScore(roundId, match.court, scoreA, scoreB);
	}

	let editingSide = $state<'teamA' | 'teamB' | null>(null);
	let labelDraft = $state('');

	function startEditing(side: 'teamA' | 'teamB') {
		editingSide = side;
		labelDraft = sideLabels[side] ?? '';
	}

	function saveLabel(side: 'teamA' | 'teamB') {
		tournamentStore.setCourtLabel(match.court, side, labelDraft);
		editingSide = null;
	}
</script>

<div class="card match">
	<CourtBackdrop />
	<div class="content">
		<div class="court-label">Court {match.court}</div>

		<div class="team">
			<div class="team-info">
				{#if editingSide === 'teamA'}
					<input
						class="side-label-input"
						bind:value={labelDraft}
						onblur={() => saveLabel('teamA')}
						onkeydown={(e) => e.key === 'Enter' && saveLabel('teamA')}
						placeholder="Side label"
					/>
				{:else}
					<button class="side-label" onclick={() => startEditing('teamA')}>
						{sideLabels.teamA ?? '+ label'}
					</button>
				{/if}
				<span class="players">{playerName(match.teamA[0])} &amp; {playerName(match.teamA[1])}</span>
			</div>
			<input
				type="number"
				min="0"
				max={maxScore}
				bind:value={scoreA}
				onchange={submit}
				class:win={match.score && scoreA > scoreB}
				class:lose={match.score && scoreA < scoreB}
			/>
		</div>

		<NetZone />

		<div class="team">
			<div class="team-info">
				{#if editingSide === 'teamB'}
					<input
						class="side-label-input"
						bind:value={labelDraft}
						onblur={() => saveLabel('teamB')}
						onkeydown={(e) => e.key === 'Enter' && saveLabel('teamB')}
						placeholder="Side label"
					/>
				{:else}
					<button class="side-label" onclick={() => startEditing('teamB')}>
						{sideLabels.teamB ?? '+ label'}
					</button>
				{/if}
				<span class="players">{playerName(match.teamB[0])} &amp; {playerName(match.teamB[1])}</span>
			</div>
			<input
				type="number"
				min="0"
				max={maxScore}
				bind:value={scoreB}
				onchange={submit}
				class:win={match.score && scoreB > scoreA}
				class:lose={match.score && scoreB < scoreA}
			/>
		</div>
	</div>
</div>

<style>
	.match {
		position: relative;
		overflow: hidden;
		padding: 1.75rem 1.25rem;
	}
	.content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.court-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #ffffff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
	}
	.team {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: var(--court-panel);
		border-radius: 10px;
		padding: 0.5rem 0.65rem;
		color: var(--text);
	}
	.team-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.players {
		font-weight: 500;
	}
	.side-label {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0;
		font-size: 0.7rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.side-label-input {
		font-size: 0.7rem;
		padding: 0.1rem 0.3rem;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		width: 8rem;
	}
	.team input[type='number'] {
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
	.team input[type='number'].win {
		background: var(--win-bg);
		border-color: var(--win-border);
	}
	.team input[type='number'].lose {
		background: var(--lose-bg);
		border-color: var(--lose-border);
	}
</style>
