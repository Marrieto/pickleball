<script lang="ts">
	import { ZOEZI_ORIGIN, parseImport, importedPlayer, nameMatches, type ZoeziImport, type ImportChoice } from '$lib/zoezi/import';
	import type { Player } from '$lib/types';
	import helper from '$lib/zoezi/helper.js.txt?raw';

	/** `players` are who the tournament will start with; `staged` is applied by the parent when it starts. */
	let { players, staged = $bindable(null) }: {
		players: Player[];
		staged: { data: ZoeziImport; choices: ImportChoice[] } | null;
	} = $props();

	const bookmarklet = 'javascript:' + encodeURIComponent(helper);
	let text = $state('');
	let data = $state<ZoeziImport | null>(null);
	let decisions = $state<Record<number, string>>({});
	let error = $state('');
	let unresolved = $derived(data?.participants.some(p => !decisions[p.id]) ?? false);
	let selectedCount = $derived(data?.participants.filter(p => decisions[p.id] && decisions[p.id] !== 'skip').length ?? 0);

	function preview() {
		error = ''; data = null;
		try {
			data = parseImport(text);
			decisions = Object.fromEntries(data.participants.map(p => {
				const [match] = nameMatches(players, p.name);
				return [p.id, match ? 'link:' + match.id : 'add'];
			}));
		} catch (e) { error = (e as Error).message; }
	}
	function stage() {
		if (!data || unresolved) return;
		staged = {
			data,
			choices: data.participants.map(p => {
				const decision = decisions[p.id];
				if (importedPlayer(players, p.id) || decision === 'skip') return { memberId: p.id, action: 'skip' };
				return decision === 'add' ? { memberId: p.id, action: 'add' } : { memberId: p.id, action: 'link', playerId: decision.slice(5) };
			})
		};
		data = null; text = '';
	}
</script>

<details class="import">
	<summary>Import players from Zoezi</summary>
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
			<textarea bind:value={text} oninput={() => { data = null; error = ''; }} placeholder="Paste the data copied from Zoezi" spellcheck="false"></textarea>
		</label>
		<button type="button" onclick={preview} disabled={!text.trim()}>Preview import</button>
		{#if error}<p role="alert" class="error">{error}</p>{/if}
		{#if staged}<p role="status">{staged.choices.filter(c => c.action !== 'skip').length} players will be added when you start. <button type="button" class="link" onclick={() => (staged = null)}>Clear</button></p>{/if}
		{#if data}
			<strong>{data.workout.title}</strong>
			<p>{data.workout.startTime} · {data.participants.length} confirmed participants</p>
			{#each data.participants as participant (participant.id)}
				<div class="participant">
					<span>{participant.name}</span>
						<label>Action for {participant.name}
							<select bind:value={decisions[participant.id]}>
								<option value="add">Add as a new player</option>
								<option value="skip">Skip this participant</option>
								{#each nameMatches(players, participant.name) as player, index}
									<option value={'link:' + player.id}>Link existing {player.name} ({index + 1}{player.active ? '' : ', removed'})</option>
								{/each}
							</select>
						</label>
				</div>
			{:else}
				<p>No confirmed participants to import.</p>
			{/each}
						<button type="button" disabled={unresolved || !selectedCount} onclick={stage}>Add {selectedCount} players</button>
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
	textarea, select, button { box-sizing: border-box; min-width: 0; width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem; background: var(--bg); color: var(--text); font: inherit; }
	textarea { min-height: 5rem; resize: vertical; }
	button { background: var(--primary); color: var(--primary-contrast); font-weight: 600; }
	button:disabled { opacity: 0.5; }
	.participant { display: grid; gap: 0.4rem; padding: 0.6rem; background: var(--bg); border-radius: 8px; overflow-wrap: anywhere; }
	.error { color: var(--danger); }
	button.link { width: auto; display: inline; padding: 0; border: none; background: none; color: var(--primary); text-decoration: underline; font-weight: 400; }
</style>
