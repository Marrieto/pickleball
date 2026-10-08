<script lang="ts">
	import { base } from '$app/paths';
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import ZoeziImport from './ZoeziImport.svelte';
	import { onMount, type ComponentProps } from 'svelte';
	import { makeId } from '$lib/id';
	import { SCORE_DEFAULTS, SETUP_DEFAULTS, buildSetupLink, parseSetupLink } from '$lib/setup-link';
	import type { EntryMode, PairingFormat, PairingStyle, Player, ScoringMode } from '$lib/types';

	let name = $state(SETUP_DEFAULTS.name);
	let courtCount = $state(SETUP_DEFAULTS.courtCount);
	let entryMode = $state<EntryMode>(SETUP_DEFAULTS.entryMode);
	let pairingFormat = $state<PairingFormat>(SETUP_DEFAULTS.pairingFormat);
	let pairingStyle = $state<PairingStyle>(SETUP_DEFAULTS.pairingStyle);
	let scoringMode = $state<ScoringMode>(SETUP_DEFAULTS.scoringMode);
	let targetScore = $state(SETUP_DEFAULTS.targetScore);
	/** Players that arrived in a setup link; they replace the lineup remembered on this device. */
	let linkPlayers = $state<Player[] | null>(null);
	let lineup = $derived(linkPlayers ?? tournamentStore.startingLineup);
	let linkCopied = $state(false);
	let linkText = $state('');

	onMount(() => {
		const { config, players } = parseSetupLink(window.location.search);
		if (window.location.search) history.replaceState(history.state, '', window.location.pathname);
		name = config.name ?? name;
		courtCount = config.courtCount ?? courtCount;
		scoringMode = config.scoringMode ?? scoringMode;
		targetScore = config.targetScore ?? targetScore;
		entryMode = config.entryMode ?? entryMode;
		pairingFormat = config.pairingFormat ?? pairingFormat;
		pairingStyle = config.pairingStyle ?? pairingStyle;
		if (players.length) {
			// Reuse a remembered person's id so their identity carries over between sessions.
			const known = new Map(tournamentStore.knownPlayers.map((p) => [p.name.toLocaleLowerCase('sv'), p.id]));
			linkPlayers = players.map((playerName) => ({
				id: known.get(playerName.toLocaleLowerCase('sv')) ?? makeId(),
				name: playerName,
				active: true,
				startingPoints: 0
			}));
		}
	});

	async function copyLink() {
		const names = [
			...lineup.map((player) => player.name),
			...(zoeziImport?.choices
				.filter((choice) => choice.action === 'add')
				.map((choice) => zoeziImport!.data.participants.find((p) => p.id === choice.memberId)?.name ?? '') ?? [])
		];
		linkText = buildSetupLink(
			window.location.href,
			{ name, courtCount, targetScore, scoringMode, entryMode, pairingFormat, pairingStyle },
			names
		);
		try {
			await navigator.clipboard.writeText(linkText);
			linkCopied = true;
			setTimeout(() => (linkCopied = false), 2000);
		} catch {
			// Clipboard needs a secure context; the text box below lets them copy by hand.
		}
	}
	let zoeziImport = $state<ComponentProps<typeof ZoeziImport>['staged']>(null);

	function onScoringModeChange(mode: ScoringMode) {
		scoringMode = mode;
		targetScore = SCORE_DEFAULTS[mode].default;
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		tournamentStore.startTournament(name.trim() || 'Tournament', courtCount, targetScore, {
			entryMode,
			pairingFormat,
			pairingStyle,
			scoringMode
		}, linkPlayers ?? undefined);
		if (zoeziImport) tournamentStore.importZoezi(zoeziImport.data, zoeziImport.choices);
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
		{#if entryMode === 'teams'}
			{pairingFormat === 'americano'
				? 'Fixed pairs — each team meets every other team once before any rematch.'
				: 'Fixed pairs — teams are matched by standing, so the leaders meet on court 1.'}
		{:else}
			{pairingFormat === 'americano'
				? 'Americano format — partners rotate each round so everyone eventually partners with everyone.'
				: 'Mexicano format — rounds are paired dynamically from current standings.'}
		{/if}
	</p>

	<label>
		Tournament name
		<input bind:value={name} required />
	</label>

	<fieldset>
		<legend>Play as</legend>
		<label class="choice">
			<input type="radio" bind:group={entryMode} value="individual" />
			Individuals
		</label>
		<label class="choice">
			<input type="radio" bind:group={entryMode} value="teams" />
			Fixed pairs
		</label>
	</fieldset>

	<fieldset>
		<legend>{entryMode === 'teams' ? 'Matchmaking' : 'Pairing format'}</legend>
		<label class="choice">
			<input type="radio" bind:group={pairingFormat} value="mexicano" />
			{entryMode === 'teams' ? 'Rank-based' : 'Mexicano'}
		</label>
		<label class="choice">
			<input type="radio" bind:group={pairingFormat} value="americano" />
			{entryMode === 'teams' ? 'Rotation' : 'Americano'}
		</label>
	</fieldset>

	{#if pairingFormat === 'mexicano' && entryMode === 'individual'}
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

	{#if linkPlayers}
		<div class="link-players">
			<strong>Players from link ({linkPlayers.length})</strong>
			<p>{linkPlayers.map((player) => player.name).join(', ')}</p>
			<button type="button" class="link" onclick={() => (linkPlayers = null)}>Clear</button>
		</div>
	{/if}

	<ZoeziImport players={lineup} bind:staged={zoeziImport} />

	<div class="share">
		<button type="button" class="secondary" onclick={copyLink}>
			{linkCopied ? 'Link copied ✓' : 'Copy setup link'}
		</button>
		{#if linkText}
			<input readonly value={linkText} aria-label="Setup link" onfocus={(e) => e.currentTarget.select()} />
		{/if}
		<p class="hint">Opens this setup, players included, on any device.</p>
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
	.link-players {
		display: grid;
		gap: 0.3rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: 0.875rem;
	}
	.link-players p {
		margin: 0;
		overflow-wrap: anywhere;
		color: var(--text-muted);
	}
	button.link {
		justify-self: start;
		padding: 0;
		border: none;
		background: none;
		color: var(--primary);
		text-decoration: underline;
	}
	.share {
		display: grid;
		gap: 0.5rem;
	}
	.share .hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.share input {
		min-width: 0;
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--text);
		font-size: 0.75rem;
	}
	button.secondary {
		padding: 0.65rem;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		font-weight: 600;
	}
</style>
