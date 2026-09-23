<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import { applyScoreSelection } from '$lib/score-entry';
	import CourtBackdrop from './CourtBackdrop.svelte';
	import NetZone from './NetZone.svelte';
	import ScorePicker from './ScorePicker.svelte';
	import type { CourtMatch, CourtSideLabels, ScoringMode } from '$lib/types';

	let {
		match,
		roundId,
		maxScore,
		scoringMode,
		playerName,
		sideLabels
	}: {
		match: CourtMatch;
		roundId: string;
		maxScore: number;
		scoringMode: ScoringMode;
		playerName: (id: string) => string;
		sideLabels: CourtSideLabels;
	} = $props();

	let scoreA = $state(match.score?.teamAPoints ?? 0);
	let scoreB = $state(match.score?.teamBPoints ?? 0);

	function onPick(team: 'A' | 'B', value: number) {
		const next = applyScoreSelection(scoringMode, maxScore, team, value, {
			teamAPoints: scoreA,
			teamBPoints: scoreB
		});
		scoreA = next.teamAPoints;
		scoreB = next.teamBPoints;
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
			<ScorePicker
				value={scoreA}
				max={maxScore}
				label="{playerName(match.teamA[0])} & {playerName(match.teamA[1])}"
				win={!!match.score && scoreA > scoreB}
				lose={!!match.score && scoreA < scoreB}
				onSelect={(n) => onPick('A', n)}
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
			<ScorePicker
				value={scoreB}
				max={maxScore}
				label="{playerName(match.teamB[0])} & {playerName(match.teamB[1])}"
				win={!!match.score && scoreB > scoreA}
				lose={!!match.score && scoreB < scoreA}
				onSelect={(n) => onPick('B', n)}
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
		/* position (not z-index) is enough to paint above CourtBackdrop's absolute z-index:0 -
		   an explicit z-index here would open a stacking context that traps ScorePicker's
		   fixed-position popover beneath the sticky TopBar. */
		position: relative;
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
</style>
