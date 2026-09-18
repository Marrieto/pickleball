<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { tournamentStore } from '$lib/tournament-store.svelte';
	import { browser } from '$app/environment';

	let { children } = $props();

	$effect(() => {
		const dark = tournamentStore.tournament?.settings.darkMode ?? false;
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
	});

	if (browser && 'serviceWorker' in navigator) {
		navigator.serviceWorker.register('/service-worker.js', { type: 'module' });
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href="/icon.svg" />
	<meta name="theme-color" content="#f5610a" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<title>Americano</title>
</svelte:head>

{@render children()}
