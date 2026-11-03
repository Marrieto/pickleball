<script lang="ts">
	import { base } from '$app/paths';
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import ZoeziImport from './ZoeziImport.svelte';
	import PartnerList from './PartnerList.svelte';
	import { onMount, type ComponentProps } from 'svelte';
	import { applyImport } from '$lib/zoezi/import';
	import { createTournament } from '$lib/tournament-actions';
	import { makeId } from '$lib/id';
	import { MAX_COURTS, SCORE_DEFAULTS, SETUP_DEFAULTS, buildSetupLink, parseSetupLink } from '$lib/setup-link';
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
	let zoeziImport = $state<ComponentProps<typeof ZoeziImport>['staged']>(null);
	let newName = $state('');
	let pairs = $state<[string, string][]>([]);
	let basePlayers = $derived([...lineup, ...added].filter(p => !removed.includes(p.id)));
	// applyImport mints a fresh id for every added participant each time it runs; pin them per
	// member so pairs and removals made before starting survive the list being recomputed.
	const stagedIds = new Map<number, string>();
	let players = $derived.by(() => {
		if (!zoeziImport) return basePlayers;
		const known = new Set(basePlayers.map(p => p.id));
		return applyImport({ ...createTournament('', 1, 11), players: basePlayers }, zoeziImport.data, zoeziImport.choices, 0).players
			.map(p => {
				if (!p.zoezi || known.has(p.id)) return p;
				if (!stagedIds.has(p.zoezi.memberId)) stagedIds.set(p.zoezi.memberId, p.id);
				return { ...p, id: stagedIds.get(p.zoezi.memberId)! };
			})
			.filter(p => !removed.includes(p.id));
	});
	let validPairs = $derived(pairs.filter(pair => pair.every(id => players.some(p => p.id === id))));
	let pairList = $derived(validPairs.map(pair => ({ id: pair.join('|'), playerIds: pair })));
	let scoreLimits = $derived(SCORE_DEFAULTS[scoringMode]);
	let formatHelp = $derived(pairingFormat === 'mexicano'
		? 'Matches are based on current standings, bringing similarly ranked players together. Fixed partners stay together.'
		: 'Partners rotate to minimize repeated partnerships, regardless of standings. Fixed partners stay together.');
	let rulesSummary = $derived([
		pairingFormat === 'mexicano' ? (pairingStyle === 'standard' ? 'Standard pairing' : 'Alternate pairing') : null,
		scoringMode === 'bestOf' ? `Best of ${targetScore}, points split` : `First to ${targetScore}`
	].filter(Boolean).join(' · '));
	const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
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

<form class="setup" onsubmit={submit}>
	<header class="intro">
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
	</header>

	<section class="card">
		<label>
			Tournament name
			<input bind:value={name} required />
		</label>

		<div class="field">
			<span class="field-label" id="format-label">Pairing format</span>
			<div class="segmented" role="radiogroup" aria-labelledby="format-label">
				<label><input type="radio" bind:group={pairingFormat} value="mexicano" /><span>Mexicano</span></label>
				<label><input type="radio" bind:group={pairingFormat} value="americano" /><span>Americano</span></label>
			</div>
			<p class="hint">{formatHelp}</p>
		</div>

		<div class="steppers">
			<div class="field">
				<label class="field-label" for="court-count">Courts</label>
				<div class="stepper">
					<button type="button" aria-label="Fewer courts" disabled={courtCount <= 1} onclick={() => (courtCount = clamp(courtCount - 1, 1, MAX_COURTS))}>−</button>
					<input id="court-count" type="number" min="1" max={MAX_COURTS} bind:value={courtCount} required />
					<button type="button" aria-label="More courts" disabled={courtCount >= MAX_COURTS} onclick={() => (courtCount = clamp(courtCount + 1, 1, MAX_COURTS))}>+</button>
				</div>
			</div>
			<div class="field">
				<label class="field-label" for="target-score">{scoringMode === 'bestOf' ? 'Points per match' : 'Target score'}</label>
				<div class="stepper">
					<button type="button" aria-label="Fewer points" disabled={targetScore <= scoreLimits.min} onclick={() => (targetScore = clamp(targetScore - 1, scoreLimits.min, scoreLimits.max))}>−</button>
					<input id="target-score" type="number" min={scoreLimits.min} max={scoreLimits.max} bind:value={targetScore} required />
					<button type="button" aria-label="More points" disabled={targetScore >= scoreLimits.max} onclick={() => (targetScore = clamp(targetScore + 1, scoreLimits.min, scoreLimits.max))}>+</button>
				</div>
			</div>
		</div>

		<details class="rules">
			<summary><span class="summary-text">{rulesSummary}</span><span class="change">Change</span></summary>
			<div class="rules-body">
				<fieldset>
					<legend>Scoring</legend>
					<label class="choice">
						<input type="radio" checked={scoringMode === 'firstTo'} onchange={() => onScoringModeChange('firstTo')} />
						<span>First to X</span>
					</label>
					<label class="choice">
						<input type="radio" checked={scoringMode === 'bestOf'} onchange={() => onScoringModeChange('bestOf')} />
						<span>Best of X <small>points split between teams</small></span>
					</label>
				</fieldset>
				{#if pairingFormat === 'mexicano'}
					<fieldset>
						<legend>Team pairing (also the final round's default)</legend>
						<label class="choice">
							<input type="radio" bind:group={pairingStyle} value="standard" />
							<span>Standard <small>1st + 4th vs 2nd + 3rd</small></span>
						</label>
						<label class="choice">
							<input type="radio" bind:group={pairingStyle} value="alternate" />
							<span>Alternate <small>1st + 3rd vs 2nd + 4th</small></span>
						</label>
					</fieldset>
				{/if}
			</div>
		</details>
	</section>

	<section class="card">
		<h2>Players · {players.length}</h2>

		{#if linkPlayers}
			<div class="link-players">
				<strong>Players from link ({linkPlayers.length})</strong>
				<p>{linkPlayers.map((player) => player.name).join(', ')}</p>
				<button type="button" class="link" onclick={() => (linkPlayers = null)}>Clear</button>
			</div>
		{/if}

		<ZoeziImport players={basePlayers} bind:staged={zoeziImport} />

		<div class="add-row">
			<input
				placeholder="Add player name"
				aria-label="Player name"
				bind:value={newName}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						add();
					}
				}}
			/>
			<button type="button" onclick={add} disabled={!newName.trim()}>Add</button>
		</div>

		<PartnerList
			{players}
			pairs={pairList}
			onpair={(a, b) => (pairs = [...validPairs, [a, b]])}
			onunpair={(id) => (pairs = validPairs.filter((pair) => pair.join('|') !== id))}
			onremove={(id) => (removed = [...removed, id])}
		/>
	</section>

	<div class="actions">
		<button type="submit" class="primary">Start tournament</button>
		<div class="share">
			<button type="button" class="secondary" onclick={copyLink}>
				{linkCopied ? 'Link copied ✓' : '🔗 Copy setup link'}
			</button>
			{#if linkText}
				<input readonly value={linkText} aria-label="Setup link" onfocus={(e) => e.currentTarget.select()} />
			{/if}
			<p class="hint">Opens this setup, players included, on any device.</p>
		</div>
	</div>
</form>

<style>
	.setup {
		width: min(28rem, calc(100% - 1.5rem));
		margin: clamp(1rem, 6svh, 3rem) auto 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.intro {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0 0.25rem;
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
	h2 {
		font-size: 1rem;
	}
	.card {
		padding: clamp(1rem, 4vw, 1.5rem);
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.hint {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}
	label,
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}
	.field-label {
		font-size: 0.875rem;
		color: var(--text-muted);
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
	.segmented {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.25rem;
		padding: 0.25rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg);
	}
	.segmented label {
		flex-direction: row;
		position: relative;
	}
	.segmented input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.segmented span {
		flex: 1;
		padding: 0.55rem;
		border-radius: 9px;
		text-align: center;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: background-color 150ms ease, color 150ms ease;
	}
	.segmented input:checked + span {
		background: var(--primary);
		color: var(--primary-contrast);
	}
	.segmented input:focus-visible + span {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.steppers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.stepper {
		display: grid;
		grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
		align-items: stretch;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg);
		overflow: hidden;
	}
	.stepper button {
		border: none;
		background: transparent;
		color: var(--text);
		font-size: 1.25rem;
		min-height: 2.75rem;
	}
	.stepper button:disabled {
		opacity: 0.35;
	}
	.stepper button:not(:disabled):hover {
		box-shadow: none;
		background: color-mix(in srgb, var(--primary) 10%, transparent);
	}
	.stepper input {
		border: none;
		border-radius: 0;
		background: transparent;
		text-align: center;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.stepper input::-webkit-inner-spin-button,
	.stepper input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.rules {
		border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		padding-top: 0.85rem;
	}
	.rules summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		list-style: none;
		font-size: 0.875rem;
		color: var(--text-muted);
	}
	.rules summary::-webkit-details-marker {
		display: none;
	}
	.summary-text {
		flex: 1;
		min-width: 0;
	}
	.change {
		color: var(--primary);
		font-weight: 600;
	}
	.rules[open] .change {
		visibility: hidden;
	}
	.rules-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.75rem;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	legend {
		padding: 0 0.35rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.choice {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		color: var(--text);
		font-size: 1rem;
		cursor: pointer;
	}
	.choice small {
		margin-left: 0.25rem;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.add-row {
		display: flex;
		gap: 0.5rem;
	}
	.add-row input {
		flex: 1;
	}
	.add-row button {
		padding: 0.55rem 1.1rem;
		border-radius: 10px;
		border: none;
		background: var(--primary);
		color: var(--primary-contrast);
		font-weight: 600;
	}
	.add-row button:disabled {
		opacity: 0.5;
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
	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	button.primary {
		min-height: 3.25rem;
		padding: 0.85rem;
		border-radius: 10px;
		border: none;
		background: var(--primary);
		color: var(--primary-contrast);
		font-weight: 600;
		font-size: 1.05rem;
	}
	.share {
		display: grid;
		gap: 0.5rem;
	}
	.share .hint {
		text-align: center;
		font-size: 0.75rem;
	}
	.share input {
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
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
