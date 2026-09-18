<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';

	let name = $state('Pickleball Night');
	let courtCount = $state(2);
	let targetScore = $state(8);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		tournamentStore.startTournament(name.trim() || 'Tournament', courtCount, targetScore);
	}
</script>

<form class="card setup" onsubmit={submit}>
	<div class="brand">
		<img class="logo" src="/icon.svg" alt="" />
		<h1>New Americano</h1>
	</div>
	<p class="hint">Mexicano format — rounds are paired dynamically from current standings.</p>

	<label>
		Tournament name
		<input bind:value={name} required />
	</label>

	<div class="row">
		<label>
			Courts
			<input type="number" min="1" max="12" bind:value={courtCount} required />
		</label>
		<label>
			Target score
			<input type="number" min="2" max="15" bind:value={targetScore} required />
		</label>
	</div>

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
