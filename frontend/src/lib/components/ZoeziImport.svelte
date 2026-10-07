<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import { ZOEZI_ORIGIN, parseImport, importedPlayer, nameMatches, type ZoeziImport, type ImportChoice } from '$lib/zoezi/import';
	import helper from '$lib/zoezi/helper.js.txt?raw';

	const bookmarklet = 'javascript:' + encodeURIComponent(helper);
	let text = $state('');
	let data = $state<ZoeziImport | null>(null);
	let decisions = $state<Record<number, string>>({});
	let error = $state('');
	let success = $state('');
	let startingPoints = $state(0);
	let players = $derived(tournamentStore.tournament?.players ?? []);
	let inProgress = $derived((tournamentStore.tournament?.roundIds.length ?? 0) > 0);
	let unresolved = $derived(data?.participants.some(p => !importedPlayer(players, p.id) && !decisions[p.id]) ?? false);
	let selectedCount = $derived(data?.participants.filter(p => !importedPlayer(players, p.id) && decisions[p.id] && decisions[p.id] !== 'skip').length ?? 0);

	function preview() {
		error = ''; success = ''; data = null;
		try {
			data = parseImport(text);
			decisions = Object.fromEntries(data.participants.map(p => [p.id, nameMatches(players, p.name).length ? '' : 'add']));
			startingPoints = 0;
			if (tournamentStore.standings.length) startingPoints = Math.max(0, Math.min(...tournamentStore.standings.map(s => s.totalPoints)));
		} catch (e) { error = (e as Error).message; }
	}
	function importPlayers() {
		if (!data || unresolved) return;
		error = '';
		try {
			const choices: ImportChoice[] = data.participants.map(p => {
				const decision = decisions[p.id];
				if (importedPlayer(players, p.id) || decision === 'skip') return { memberId: p.id, action: 'skip' };
				return decision === 'add' ? { memberId: p.id, action: 'add' } : { memberId: p.id, action: 'link', playerId: decision.slice(5) };
			});
			const count = selectedCount;
			tournamentStore.importZoezi(data, choices, inProgress ? startingPoints : 0);
			success = `Imported ${count} participants. Existing players and scores were preserved.`;
			data = null; text = '';
		} catch (e) { error = (e as Error).message; }
	}
</script>

<details class="import">
	<summary>Import from Zoezi</summary>
	<div class="content">
		<ol>
			<li>Drag <a href={bookmarklet} onclick={(event) => event.preventDefault()}>Zoezi → Dink City</a> to your bookmarks bar.</li>
			<li>Open <a href={ZOEZI_ORIGIN} target="_blank" rel="noreferrer">the club’s Zoezi site</a>, log in, then click that bookmark.</li>
			<li>Choose a session, preview its players, and copy the import data. Paste it below.</li>
		</ol>
		<details>
			<summary>Install the bookmark manually</summary>
			<p>Create a bookmark named “Zoezi → Dink City” and replace its URL with this complete code. Run it while viewing Zoezi in your browser.</p>
			<textarea aria-label="Bookmark URL" readonly value={bookmarklet} onfocus={event => event.currentTarget.select()}></textarea>
		</details>
		<label>Import data
			<textarea bind:value={text} oninput={() => { data = null; error = ''; success = ''; }} placeholder="Paste the data copied from Zoezi" spellcheck="false"></textarea>
		</label>
		<button type="button" onclick={preview} disabled={!text.trim()}>Preview import</button>
		{#if error}<p role="alert" class="error">{error}</p>{/if}
		{#if success}<p role="status">{success}</p>{/if}
		{#if data}
			<strong>{data.workout.title}</strong>
			<p>{data.workout.startTime} · {data.participants.length} confirmed participants</p>
			{#each data.participants as participant (participant.id)}
				{@const existing = importedPlayer(players, participant.id)}
				<div class="participant">
					<span>{participant.name}</span>
					{#if existing}
						<small>Already imported{existing.active ? '' : ' (removed from play)'} — skipped</small>
					{:else}
						<label>Action for {participant.name}
							<select bind:value={decisions[participant.id]}>
								<option value="" disabled>Same name exists — choose an action</option>
								<option value="add">Add as a new player</option>
								<option value="skip">Skip this participant</option>
								{#each nameMatches(players, participant.name) as player, index}
									<option value={'link:' + player.id}>Link existing {player.name} ({index + 1}{player.active ? '' : ', removed'})</option>
								{/each}
							</select>
						</label>
					{/if}
				</div>
			{:else}
				<p>No confirmed participants to import.</p>
			{/each}
			{#if inProgress}
				<label>Starting points for new players <input type="number" min="0" bind:value={startingPoints} /></label>
			{/if}
			<p>Players already in this tournament stay as they are. Linked players keep their scores and active status.</p>
			<button type="button" disabled={unresolved || !selectedCount || !Number.isFinite(startingPoints) || startingPoints < 0} onclick={importPlayers}>Import {selectedCount} participants</button>
		{/if}
	</div>
</details>

<style>
	.import { border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem; }
	summary { cursor: pointer; font-weight: 600; }
	.content { display: grid; gap: 0.75rem; margin-top: 0.75rem; }
	p, ol { margin: 0; font-size: 0.875rem; }
	ol { padding-left: 1.25rem; } li + li { margin-top: 0.5rem; }
	a { color: var(--primary); text-decoration: underline; }
	label { display: grid; gap: 0.3rem; font-size: 0.8rem; }
	textarea, select, input, button { box-sizing: border-box; min-width: 0; width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem; background: var(--bg); color: var(--text); font: inherit; }
	textarea { min-height: 5rem; resize: vertical; }
	button { background: var(--primary); color: var(--primary-contrast); font-weight: 600; }
	button:disabled { opacity: 0.5; }
	.participant { display: grid; gap: 0.4rem; padding: 0.6rem; background: var(--bg); border-radius: 8px; overflow-wrap: anywhere; }
	.error { color: var(--danger); }
</style>
