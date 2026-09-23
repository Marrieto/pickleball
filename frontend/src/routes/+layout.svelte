<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import { base } from '$app/paths';

	let { children } = $props();

	$effect(() => {
		const dark = tournamentStore.darkMode;
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
	});

</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={favicon} />
	<link rel="apple-touch-icon" href="{base}/apple-touch-icon.png" />
	<meta name="theme-color" content={tournamentStore.darkMode ? '#111c1b' : '#237773'} />
	<link rel="manifest" href="{base}/manifest.webmanifest" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<title>Dink City</title>
</svelte:head>

{@render children()}
