<script lang="ts">
	interface Person {
		id: string;
		name: string;
	}
	interface Pair {
		id: string;
		playerIds: [string, string];
	}

	/** Fixed partners on top, everyone else below with a two-tap Pair → Pick flow.
	 *  Shared by the setup form (local state) and the live Players panel (the store). */
	let {
		players,
		pairs,
		onpair,
		onunpair,
		onremove,
		benched,
		ontogglebench,
		readonly = false
	}: {
		players: Person[];
		pairs: Pair[];
		onpair: (a: string, b: string) => void;
		onunpair: (pairId: string) => void;
		onremove?: (id: string) => void;
		/** When given, each row gets a sit-out toggle for the next round. */
		benched?: string[];
		ontogglebench?: (id: string) => void;
		readonly?: boolean;
	} = $props();

	let pairingFrom = $state<string | null>(null);
	let paired = $derived(new Set(pairs.flatMap((pair) => pair.playerIds)));
	let singles = $derived(players.filter((p) => !paired.has(p.id)));
	// A player can be removed while chosen; drop the stale selection rather than pairing a ghost.
	let from = $derived(singles.some((p) => p.id === pairingFrom) ? pairingFrom : null);

	function name(id: string): string {
		return players.find((p) => p.id === id)?.name ?? '?';
	}

	function isBenched(id: string): boolean {
		return benched?.includes(id) ?? false;
	}

	function tapPair(id: string) {
		if (from === id) pairingFrom = null;
		else if (from) {
			onpair(from, id);
			pairingFrom = null;
		} else pairingFrom = id;
	}

	/** Partners rest together, so one toggle covers both: any benched member means the pair sits. */
	function togglePairBench(pair: Pair) {
		const sitting = pair.playerIds.some(isBenched);
		for (const id of pair.playerIds) if (isBenched(id) === sitting) ontogglebench?.(id);
	}
</script>

<div class="partners">
	<div class="section">
		<div class="heading">
			<h3>Fixed partners</h3>
			<span class="note">Always on the same team</span>
		</div>
		{#each pairs as pair (pair.id)}
			{@const sitting = pair.playerIds.some(isBenched)}
			<div class="row pair" class:sitting>
				<span class="names">
					<span>{name(pair.playerIds[0])}</span>
					<span class="linked">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
						{name(pair.playerIds[1])}
					</span>
				</span>
				{#if !readonly}
					{#if benched && !from}
						<button
							type="button"
							class="sit"
							class:on={sitting}
							aria-pressed={sitting}
							title="Sit out next round"
							onclick={() => togglePairBench(pair)}
						>
							{sitting ? 'Sitting out' : 'Playing'}
						</button>
					{/if}
					<button type="button" class="action" onclick={() => onunpair(pair.id)}>Unpair</button>
				{/if}
			</div>
		{:else}
			<p class="empty">
				No fixed partners yet.{#if !readonly}
					Tap <b>Pair</b> next to a player, then pick their partner.{/if}
			</p>
		{/each}
	</div>

	<div class="section">
		<div class="heading">
			<h3>Rotating partners</h3>
			<span class="note">{singles.length} {singles.length === 1 ? 'player' : 'players'}</span>
		</div>
		{#if from}
			<div class="picking" role="status">
				<span>Pick a partner for <b>{name(from)}</b></span>
				<button type="button" onclick={() => (pairingFrom = null)}>Cancel</button>
			</div>
		{/if}
		{#each singles as player (player.id)}
			{@const isSource = from === player.id}
			{@const pickable = !!from && !isSource}
			{@const sitting = isBenched(player.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<!-- The whole row is a larger tap target while picking; the Pick button is the accessible path. -->
			<div
				class="row"
				class:source={isSource}
				class:pickable
				class:sitting
				onclick={pickable ? () => tapPair(player.id) : undefined}
			>
				<span class="name">{player.name}</span>
				{#if !readonly}
					{#if benched && !from}
						<button
							type="button"
							class="sit"
							class:on={sitting}
							aria-pressed={sitting}
							title="Sit out next round"
							onclick={() => ontogglebench?.(player.id)}
						>
							{sitting ? 'Sitting out' : 'Playing'}
						</button>
					{/if}
					<button
						type="button"
						class="action"
						class:pick={pickable}
						onclick={(e) => {
							e.stopPropagation();
							tapPair(player.id);
						}}
					>
						{isSource ? 'Cancel' : pickable ? 'Pick' : 'Pair'}
					</button>
					{#if onremove && !from}
						<button
							type="button"
							class="remove"
							aria-label="Remove {player.name}"
							onclick={() => onremove(player.id)}
						>
							✕
						</button>
					{/if}
				{/if}
			</div>
		{:else}
			<p class="empty">Everyone has a fixed partner.</p>
		{/each}
	</div>
</div>

<style>
	.partners {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.heading {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	h3 {
		flex: 1;
		margin: 0;
		font-size: 0.875rem;
	}
	.note {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.empty {
		margin: 0;
		padding: 0.6rem 0.75rem;
		border: 1px dashed var(--border);
		border-radius: 10px;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.empty b {
		color: var(--text);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 3.25rem;
		padding: 0.3rem 0.3rem 0.3rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		border-radius: 10px;
		background: var(--bg);
	}
	.row.pair {
		border-color: var(--primary);
		background: color-mix(in srgb, var(--primary) 8%, var(--surface));
	}
	.row.pickable {
		cursor: pointer;
		border-color: var(--border);
	}
	.row.source {
		border-color: var(--primary);
		box-shadow: inset 3px 0 0 var(--primary);
		background: color-mix(in srgb, var(--primary) 12%, var(--surface));
	}
	.name,
	.names {
		flex: 1;
		min-width: 0;
		overflow-wrap: break-word;
		font-weight: 500;
		line-height: 1.3;
	}
	.row.source .name {
		font-weight: 600;
	}
	.names {
		display: flex;
		flex-direction: column;
	}
	.linked {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.linked svg {
		flex-shrink: 0;
		color: var(--primary);
	}
	.row.sitting .name,
	.row.sitting .names {
		color: var(--text-muted);
		text-decoration: line-through;
	}
	.action {
		flex-shrink: 0;
		min-width: 4rem;
		min-height: 2.5rem;
		padding: 0 0.75rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--text);
		font-size: 0.8rem;
		font-weight: 600;
	}
	.action.pick {
		border-color: var(--primary);
		background: var(--primary);
		color: var(--primary-contrast);
	}
	.sit {
		flex-shrink: 0;
		min-height: 2rem;
		padding: 0 0.65rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-muted);
		font-size: 0.75rem;
	}
	.sit.on {
		border-color: var(--warning);
		color: var(--warning);
		font-weight: 600;
	}
	.remove {
		flex-shrink: 0;
		width: 2.25rem;
		height: 2.25rem;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--text-muted);
		font-size: 1rem;
	}
	.remove:hover {
		color: var(--danger);
	}
	.picking {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.5rem 0.55rem 0.75rem;
		border-radius: 10px;
		background: var(--primary);
		color: var(--primary-contrast);
		font-size: 0.875rem;
	}
	.picking span {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.picking button {
		flex-shrink: 0;
		min-height: 2.25rem;
		padding: 0 0.75rem;
		border: 1px solid color-mix(in srgb, var(--primary-contrast) 50%, transparent);
		border-radius: 10px;
		background: transparent;
		color: var(--primary-contrast);
		font-size: 0.8rem;
	}
</style>
