<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import MatchCard from './MatchCard.svelte';
	import CourtBackdrop from './CourtBackdrop.svelte';
	import NetZone from './NetZone.svelte';
	import type { CourtMatch, PairingStyle } from '$lib/types';

	let tournament = $derived(tournamentStore.tournament!);
	let round = $derived(tournamentStore.currentRound);
	let isLatest = $derived(tournament.currentRoundIndex === tournament.roundIds.length - 1);
	let isLocked = $derived(round ? round.courts.some((c) => c.score) : false);
	let activeCount = $derived(tournament.players.filter((p) => p.active).length);

	let editing = $state(false);
	let selected = $state<string | null>(null);

	let showFinalRoundPicker = $state(false);
	// Not derived from `tournament.settings` on purpose: this is a per-generation editable
	// choice, re-synced from the setting each time the picker opens (see openFinalRoundPicker).
	let finalRoundPairingStyle = $state<PairingStyle>('standard');

	function openFinalRoundPicker() {
		finalRoundPairingStyle = tournament.settings.pairingStyle;
		showFinalRoundPicker = true;
	}

	function confirmFinalRound() {
		tournamentStore.generateFinalRound(finalRoundPairingStyle);
		showFinalRoundPicker = false;
	}

	function playerName(id: string): string {
		return tournament.players.find((p) => p.id === id)?.name ?? '?';
	}

	function findSlot(
		courts: CourtMatch[],
		id: string
	): { court: number; team: 'A' | 'B'; index: 0 | 1 } | null {
		for (const c of courts) {
			const ai = c.teamA.indexOf(id);
			if (ai !== -1) return { court: c.court, team: 'A', index: ai as 0 | 1 };
			const bi = c.teamB.indexOf(id);
			if (bi !== -1) return { court: c.court, team: 'B', index: bi as 0 | 1 };
		}
		return null;
	}

	function selectPlayer(id: string) {
		if (!editing) return;
		if (selected === id) {
			selected = null;
			return;
		}
		if (!selected) {
			selected = id;
			return;
		}
		swap(selected, id);
		selected = null;
	}

	function swap(idX: string, idY: string) {
		if (!round) return;
		const slotX = findSlot(round.courts, idX);
		const slotY = findSlot(round.courts, idY);
		if (!slotX || !slotY) return;

		const courtX = round.courts.find((c) => c.court === slotX.court)!;
		const teamAX = [...courtX.teamA] as [string, string];
		const teamBX = [...courtX.teamB] as [string, string];
		(slotX.team === 'A' ? teamAX : teamBX)[slotX.index] = idY;

		if (slotX.court === slotY.court) {
			(slotY.team === 'A' ? teamAX : teamBX)[slotY.index] = idX;
			tournamentStore.editRoundAssignment(round.id, courtX.court, teamAX, teamBX);
		} else {
			const courtY = round.courts.find((c) => c.court === slotY.court)!;
			const teamAY = [...courtY.teamA] as [string, string];
			const teamBY = [...courtY.teamB] as [string, string];
			(slotY.team === 'A' ? teamAY : teamBY)[slotY.index] = idX;

			tournamentStore.editRoundAssignment(round.id, courtX.court, teamAX, teamBX);
			tournamentStore.editRoundAssignment(round.id, courtY.court, teamAY, teamBY);
		}
	}
</script>

{#snippet finalRoundPicker()}
	<div class="card final-round-picker">
		<p class="hint">Final round pairing:</p>
		<label>
			<input type="radio" bind:group={finalRoundPairingStyle} value="standard" />
			Standard (1st+4th vs 2nd+3rd)
		</label>
		<label>
			<input type="radio" bind:group={finalRoundPairingStyle} value="alternate" />
			Alternate (1st+3rd vs 2nd+4th)
		</label>
		<div class="picker-actions">
			<button onclick={() => (showFinalRoundPicker = false)}>Cancel</button>
			<button class="primary" onclick={confirmFinalRound}>Confirm</button>
		</div>
	</div>
{/snippet}

{#if round}
	<section class="round">
		<div class="round-header">
			<button
				class="nav"
				onclick={() => tournamentStore.goToRound(tournament.currentRoundIndex - 1)}
				disabled={tournament.currentRoundIndex <= 0}
			>
				‹
			</button>
			<h2>Round {round.roundNumber}</h2>
			<button
				class="nav"
				onclick={() => tournamentStore.goToRound(tournament.currentRoundIndex + 1)}
				disabled={isLatest}
			>
				›
			</button>
		</div>

		{#if round.sittingOut.length > 0}
			<p class="sitting-out">Sitting out: {round.sittingOut.map(playerName).join(', ')}</p>
		{/if}

		{#if isLatest && !isLocked}
			<button class="edit-toggle" onclick={() => (editing = !editing)}>
				{editing ? 'Done editing' : 'Edit matchups'}
			</button>
		{/if}

		<div class="courts">
			{#each round.courts as match (round.id + '-' + match.court)}
				{#if editing}
					<div class="card match editable">
						<CourtBackdrop />
						<div class="content">
							<div class="court-label">Court {match.court}</div>
							{#if tournament.courtLabels[match.court]?.teamA}
								<div class="side-label">{tournament.courtLabels[match.court]?.teamA}</div>
							{/if}
							<div class="editable-team">
								{#each match.teamA as id (id)}
									<button
										class="chip"
										class:selected={selected === id}
										onclick={() => selectPlayer(id)}
									>
										{playerName(id)}
									</button>
								{/each}
							</div>
							<NetZone />
							{#if tournament.courtLabels[match.court]?.teamB}
								<div class="side-label">{tournament.courtLabels[match.court]?.teamB}</div>
							{/if}
							<div class="editable-team">
								{#each match.teamB as id (id)}
									<button
										class="chip"
										class:selected={selected === id}
										onclick={() => selectPlayer(id)}
									>
										{playerName(id)}
									</button>
								{/each}
							</div>
						</div>
					</div>
				{:else}
					<MatchCard
						{match}
						roundId={round.id}
						maxScore={tournament.targetScore}
						scoringMode={tournament.settings.scoringMode}
						{playerName}
						sideLabels={tournament.courtLabels[match.court] ?? {}}
					/>
				{/if}
			{/each}
		</div>

		{#if isLatest}
			<div class="round-actions">
				<button class="primary generate" onclick={() => tournamentStore.generateNextRound()}>
					Generate next round
				</button>
				<button class="secondary" onclick={openFinalRoundPicker}> Generate Final Round </button>
			</div>
			{#if showFinalRoundPicker}
				{@render finalRoundPicker()}
			{/if}
		{/if}
	</section>
{:else}
	<div class="card empty-state">
		<p>No rounds yet.</p>
		<button
			class="primary"
			onclick={() => tournamentStore.generateNextRound()}
			disabled={activeCount < 4}
		>
			Generate round 1
		</button>
		<button class="secondary" onclick={openFinalRoundPicker} disabled={activeCount < 4}>
			Generate Final Round
		</button>
		{#if activeCount < 4}
			<p class="hint">Add at least 4 players first.</p>
		{/if}
		{#if showFinalRoundPicker}
			{@render finalRoundPicker()}
		{/if}
	</div>
{/if}

<style>
	.round {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.round-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}
	.round-header h2 {
		font-size: 1.1rem;
		min-width: 8rem;
		text-align: center;
	}
	button.nav {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		font-size: 1.1rem;
	}
	button.nav:disabled {
		opacity: 0.35;
	}
	.sitting-out {
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
	}
	.edit-toggle {
		align-self: center;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		border-radius: 10px;
		padding: 0.4rem 0.9rem;
		font-size: 0.8rem;
	}
	.courts {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	}
	.match.editable {
		position: relative;
		overflow: hidden;
		padding: 1.75rem 1.25rem;
	}
	.match.editable .content {
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
	.side-label {
		font-size: 0.7rem;
		color: #ffffff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-top: -0.35rem;
	}
	.editable-team {
		display: flex;
		gap: 0.5rem;
	}
	.chip {
		flex: 1;
		padding: 0.6rem;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--court-panel);
		color: var(--text);
	}
	.chip.selected {
		border-color: var(--primary);
		background: color-mix(in srgb, var(--primary) 20%, var(--court-panel));
	}
	.round-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
	}
	.generate {
		align-self: center;
	}
	button.primary {
		padding: 0.75rem 1.5rem;
		border-radius: 10px;
		border: none;
		background: var(--primary);
		color: var(--primary-contrast);
		font-weight: 600;
	}
	button.primary:disabled {
		opacity: 0.5;
	}
	button.secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		font-weight: 600;
	}
	button.secondary:disabled {
		opacity: 0.5;
	}
	.final-round-picker {
		align-self: center;
		max-width: 320px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.final-round-picker label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}
	.picker-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}
	.picker-actions button {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
	}
	.empty-state {
		padding: 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}
	.hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
</style>
