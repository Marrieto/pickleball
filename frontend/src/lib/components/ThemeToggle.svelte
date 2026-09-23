<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';

	let label = $derived(tournamentStore.darkMode ? 'Switch to light mode' : 'Switch to dark mode');
</script>

<button type="button" onclick={() => tournamentStore.toggleDarkMode()} aria-label={label} title={label}>
	{tournamentStore.darkMode ? '☀️' : '🌙'}
</button>

<style>
	button {
		border: 1px solid currentColor;
		background: transparent;
		color: inherit;
		border-radius: 10px;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		flex-shrink: 0;
	}
</style>
