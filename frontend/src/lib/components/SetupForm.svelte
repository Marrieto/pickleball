<script lang="ts">
	import { base } from '$app/paths';
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import type { PairingFormat, PairingStyle, ScoringMode } from '$lib/types';

	const SCORE_DEFAULTS: Record<ScoringMode, { default: number; min: number; max: number }> = {
		firstTo: { default: 11, min: 2, max: 15 },
		bestOf: { default: 21, min: 4, max: 40 }
	};

	let name = $state('Pickleball Night');
	let courtCount = $state(2);
	let pairingFormat = $state<PairingFormat>('mexicano');
	let pairingStyle = $state<PairingStyle>('standard');
	let scoringMode = $state<ScoringMode>('firstTo');
	let targetScore = $state(SCORE_DEFAULTS.firstTo.default);

	function onScoringModeChange(mode: ScoringMode) {
		scoringMode = mode;
		targetScore = SCORE_DEFAULTS[mode].default;
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		tournamentStore.startTournament(name.trim() || 'Tournament', courtCount, targetScore, {
			pairingFormat,
			pairingStyle,
			scoringMode
		});
	}
</script>

<form class="card setup" onsubmit={submit}>
	<img
		class="logo"
		src="{base}/branding/club-{tournamentStore.darkMode ? 'negative' : 'positive'}.svg"
		alt="Kalmar Pickleballklubb"
		width="276"
		height="122"
	/>
	<div class="brand">
		<h1>Dink City</h1>
		<ThemeToggle />
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

	{#if pairingFormat === 'mexicano'}
		<fieldset>
			<legend>Team pairing (also the final round's default)</legend>
			<label class="choice">
				<input type="radio" bind:group={pairingStyle} value="standard" />
				Standard (1st+4th vs 2nd+3rd)
			</label>
			<label class="choice">
				<input type="radio" bind:group={pairingStyle} value="alternate" />
				Alternate (1st+3rd vs 2nd+4th)
			</label>
		</fieldset>
	{/if}

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

	<button type="submit" class="primary">Start tournament</button>
</form>

<style>
	.setup {
		width: min(26.25rem, calc(100% - 1.5rem));
		margin: 1rem auto;
		margin: clamp(1rem, 8svh, 4rem) auto 1rem;
		padding: clamp(1rem, 4vw, 2rem);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.brand {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.logo {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 275.698 / 122.36;
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
		min-width: 0;
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
		min-width: 0;
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
