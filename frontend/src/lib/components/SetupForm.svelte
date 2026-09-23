<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import type { FinalRoundPairingStyle, PairingFormat, ScoringMode } from '$lib/types';

	const SCORE_DEFAULTS: Record<ScoringMode, { default: number; min: number; max: number }> = {
		firstTo: { default: 11, min: 2, max: 15 },
		bestOf: { default: 21, min: 4, max: 40 }
	};

	let name = $state('Pickleball Night');
	let courtCount = $state(2);
	let pairingFormat = $state<PairingFormat>('mexicano');
	let scoringMode = $state<ScoringMode>('firstTo');
	let targetScore = $state(SCORE_DEFAULTS.firstTo.default);
	let finalRoundPairingStyle = $state<FinalRoundPairingStyle>('standard');

	function onScoringModeChange(mode: ScoringMode) {
		scoringMode = mode;
		targetScore = SCORE_DEFAULTS[mode].default;
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		tournamentStore.startTournament(name.trim() || 'Tournament', courtCount, targetScore, {
			pairingFormat,
			scoringMode,
			finalRoundPairingStyle
		});
	}
</script>

<form class="card setup" onsubmit={submit}>
	<div class="brand">
		<img class="logo" src="/icon.svg" alt="" />
		<h1>New Americano</h1>
	</div>
	<p class="hint">
		{pairingFormat === 'americano'
			? 'Americano format — partners rotate each round so everyone eventually partners with everyone.'
			: 'Mexicano format — rounds are paired dynamically from current standings.'}
	</p>

	<label>
		Tournament name
		<input bind:value={name} required />
	</label>

	<fieldset>
		<legend>Pairing format</legend>
		<label class="choice">
			<input type="radio" bind:group={pairingFormat} value="mexicano" />
			Mexicano
		</label>
		<label class="choice">
			<input type="radio" bind:group={pairingFormat} value="americano" />
			Americano
		</label>
	</fieldset>

	<fieldset>
		<legend>Scoring</legend>
		<label class="choice">
			<input
				type="radio"
				checked={scoringMode === 'firstTo'}
				onchange={() => onScoringModeChange('firstTo')}
			/>
			First to X
		</label>
		<label class="choice">
			<input
				type="radio"
				checked={scoringMode === 'bestOf'}
				onchange={() => onScoringModeChange('bestOf')}
			/>
			Best of X (points split between teams)
		</label>
	</fieldset>

	<div class="row">
		<label>
			Courts
			<input type="number" min="1" max="12" bind:value={courtCount} required />
		</label>
		<label>
			{scoringMode === 'bestOf' ? 'Points per match' : 'Target score'}
			<input
				type="number"
				min={SCORE_DEFAULTS[scoringMode].min}
				max={SCORE_DEFAULTS[scoringMode].max}
				bind:value={targetScore}
				required
			/>
		</label>
	</div>

	<fieldset>
		<legend>Final round pairing (default, changeable when generated)</legend>
		<label class="choice">
			<input type="radio" bind:group={finalRoundPairingStyle} value="standard" />
			Standard (1st+4th vs 2nd+3rd)
		</label>
		<label class="choice">
			<input type="radio" bind:group={finalRoundPairingStyle} value="alternate" />
			Alternate (1st+3rd vs 2nd+4th)
		</label>
	</fieldset>

	<button type="submit" class="primary">Start tournament</button>
</form>

<style>
	.setup {
		max-width: 420px;
		margin: 8vh auto 0;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.logo {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 8px;
		flex-shrink: 0;
	}
	h1 {
		font-size: 1.5rem;
	}
	.hint {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}
	.row {
		display: flex;
		gap: 1rem;
	}
	.row label {
		flex: 1;
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.25rem;
	}
	legend {
		padding: 0 0.35rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.choice {
		flex-direction: row !important;
		align-items: center;
		gap: 0.4rem !important;
		color: var(--text);
	}
	input {
		padding: 0.6rem 0.75rem;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--text);
		font-size: 1rem;
	}
	button.primary {
		padding: 0.85rem;
		border-radius: 10px;
		border: none;
		background: var(--primary);
		color: var(--primary-contrast);
		font-weight: 600;
		font-size: 1rem;
	}
</style>
