<script lang="ts">
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import SetupForm from '$lib/components/SetupForm.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import PlayerRoster from '$lib/components/PlayerRoster.svelte';
	import RoundView from '$lib/components/RoundView.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
</script>

{#if !tournamentStore.tournament}
	<SetupForm />
{:else}
	<TopBar />
	<main>
		<div class="column">
			<RoundView />
		</div>
		<div class="column sidebar">
			<PlayerRoster />
			<Leaderboard />
		</div>
	</main>
{/if}

<style>
	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1.25rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.25rem;
	}
	@media (min-width: 860px) {
		main {
			grid-template-columns: 2fr 1fr;
			align-items: start;
		}
	}
	.column {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
</style>
