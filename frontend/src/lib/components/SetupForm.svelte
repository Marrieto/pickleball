<script lang="ts">
	import { base } from '$app/paths';
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import ZoeziImport from './ZoeziImport.svelte';
	import { onMount, type ComponentProps } from 'svelte';
	import { applyImport } from '$lib/zoezi/import';
	import { createTournament } from '$lib/tournament-actions';
	import { makeId } from '$lib/id';
	import { SCORE_DEFAULTS, SETUP_DEFAULTS, buildSetupLink, parseSetupLink } from '$lib/setup-link';
	import type { PairingFormat, PairingStyle, Player, ScoringMode } from '$lib/types';

	let name = $state(SETUP_DEFAULTS.name);
	let courtCount = $state(SETUP_DEFAULTS.courtCount);

	let pairingFormat = $state<PairingFormat>(SETUP_DEFAULTS.pairingFormat);
	let pairingStyle = $state<PairingStyle>(SETUP_DEFAULTS.pairingStyle);
	let scoringMode = $state<ScoringMode>(SETUP_DEFAULTS.scoringMode);
	let targetScore = $state(SETUP_DEFAULTS.targetScore);
	/** Players that arrived in a setup link; they replace the lineup remembered on this device. */
	let linkPlayers = $state<Player[] | null>(null);
	let lineup = $derived(linkPlayers ?? tournamentStore.startingLineup);
	let added = $state<Player[]>([]);
	let removed = $state<string[]>([]);
	let newName = $state('');
	let selected = $state('');
	let pairs = $state<[string, string][]>([]);
	let basePlayers = $derived([...lineup, ...added].filter(p => !removed.includes(p.id)));
	let players = $derived(zoeziImport ? applyImport({ ...createTournament('', 1, 11), players: basePlayers }, zoeziImport.data, zoeziImport.choices, 0).players : basePlayers);
	let validPairs = $derived(pairs.filter(pair => pair.every(id => players.some(p => p.id === id))));
	function pick(id: string) {
		if (selected === id) selected = '';
		else if (selected && players.some(p => p.id === selected)) { pairs = [...validPairs, [selected, id]]; selected = ''; }
		else selected = id;
	}
	function add() {
		if (!newName.trim()) return;
		added = [...added, { id: makeId(), name: newName.trim(), active: true, startingPoints: 0 }];
		newName = '';
	}
	let linkCopied = $state(false);
	let linkText = $state('');

	onMount(() => {
		const { config, players, pairs: linkedPairs } = parseSetupLink(window.location.search);
		if (window.location.search) history.replaceState(history.state, '', window.location.pathname);
		name = config.name ?? name;
		courtCount = config.courtCount ?? courtCount;
		scoringMode = config.scoringMode ?? scoringMode;
		targetScore = config.targetScore ?? targetScore;

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
			pairs = linkedPairs.map(pair => pair.map(name => linkPlayers!.find(p => p.name === name)!.id) as [string, string]);
		}
	});

	async function copyLink() {
		const names = players.map(p => p.name);
		linkText = buildSetupLink(
			window.location.href,
			{ name, courtCount, targetScore, scoringMode, entryMode: 'individual', pairingFormat, pairingStyle },
			names, validPairs.map(pair => pair.map(id => players.find(p => p.id === id)!.name) as [string, string])
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
		const startingPlayers = players;
		const startingPairs = validPairs;
		tournamentStore.startTournament(name.trim() || 'Tournament', courtCount, targetScore, {
			entryMode: 'individual',
			pairingFormat,
			pairingStyle,
			scoringMode
		}, startingPlayers);
		for (const [a, b] of startingPairs) tournamentStore.createTeam(a, b);
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
	<p class="hint">Choose a format and optionally keep selected partners together. Everyone has an individual score.</p>

	<label>
		Tournament name
		<input bind:value={name} required />
	</label>

	<fieldset>
		<legend>Pairing format</legend>
		<label class="choice"><input type="radio" bind:group={pairingFormat} value="mexicano" />Mexicano</label>
		<p class="hint">Matches are based on current standings, bringing similarly ranked players together. Fixed partners stay together.</p>
		<label class="choice"><input type="radio" bind:group={pairingFormat} value="americano" />Americano</label>
		<p class="hint">Partners rotate to minimize repeated partnerships, regardless of standings. Fixed partners stay together.</p>
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

	{#if linkPlayers}
		<div class="link-players">
			<strong>Players from link ({linkPlayers.length})</strong>
			<p>{linkPlayers.map((player) => player.name).join(', ')}</p>
			<button type="button" class="link" onclick={() => (linkPlayers = null)}>Clear</button>
		</div>
	{/if}

	<ZoeziImport players={basePlayers} bind:staged={zoeziImport} />

	<fieldset>
		<legend>Players and fixed partners</legend>
		<p class="hint">Tap two players to keep them together. Everyone else rotates partners.</p>
		<label>Player name<input bind:value={newName} /></label>
		<button type="button" onclick={add} disabled={!newName.trim()}>Add player</button>
		{#each validPairs as pair}
			<button type="button" onclick={() => pairs = pairs.filter(p => p !== pair)}>{pair.map(id => players.find(p => p.id === id)!.name).join(' & ')} · Unpair</button>
		{/each}
		{#each players.filter(p => !validPairs.some(pair => pair.includes(p.id))) as player (player.id)}
			<div class="row">
				<button type="button" aria-pressed={selected === player.id} onclick={() => pick(player.id)}>{player.name}{selected === player.id ? ' · Choose partner' : ''}</button>
				<button type="button" aria-label="Remove {player.name}" onclick={() => { removed = [...removed, player.id]; selected = ''; }}>✕</button>
			</div>
		{/each}
	</fieldset>
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
