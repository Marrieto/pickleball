<script lang="ts">
	let {
		value,
		max,
		label,
		win = false,
		lose = false,
		onSelect
	}: {
		value: number;
		max: number;
		label: string;
		win?: boolean;
		lose?: boolean;
		onSelect: (n: number) => void;
	} = $props();

	// Below this viewport width the picker goes fullscreen for easier touch use;
	// at or above it, it anchors as a small popover over the tapped score.
	const ANCHORED_BREAKPOINT = '(min-width: 1080px)';

	let open = $state(false);
	let fullscreen = $state(true);
	let positioned = $state(false);
	let leftPx = $state(0);
	let topPx = $state(0);
	let buttonEl: HTMLButtonElement | undefined = $state();
	let popoverEl: HTMLDivElement | undefined = $state();
	let options = $derived(Array.from({ length: max + 1 }, (_, n) => n));

	$effect(() => {
		const mq = window.matchMedia(ANCHORED_BREAKPOINT);
		const update = () => (fullscreen = !mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});

	$effect(() => {
		if (!open || fullscreen) {
			positioned = fullscreen; // fullscreen needs no measurement, it's ready immediately
			return;
		}
		positionOverButton();
		const reposition = () => positionOverButton();
		window.addEventListener('resize', reposition);
		return () => window.removeEventListener('resize', reposition);
	});

	function positionOverButton() {
		if (!buttonEl || !popoverEl) return;
		const button = buttonEl.getBoundingClientRect();
		const popover = popoverEl.getBoundingClientRect();
		const margin = 12;
		leftPx = clampNum(
			button.left + button.width / 2 - popover.width / 2,
			margin,
			window.innerWidth - popover.width - margin
		);
		topPx = clampNum(
			button.top + button.height / 2 - popover.height / 2,
			margin,
			window.innerHeight - popover.height - margin
		);
		positioned = true;
	}

	function clampNum(n: number, lo: number, hi: number): number {
		return Math.min(Math.max(n, lo), Math.max(lo, hi));
	}

	function pick(n: number) {
		onSelect(n);
		open = false;
	}
</script>

<button
	type="button"
	class="score-button"
	class:win
	class:lose
	bind:this={buttonEl}
	aria-label="{label} score, currently {value}. Tap to change."
	onclick={() => (open = true)}
>
	{value}
</button>

{#if open}
	<button class="backdrop" aria-label="Close score picker" onclick={() => (open = false)}></button>
	<div
		class="popover card"
		class:fullscreen
		class:positioned
		style:left={!fullscreen ? `${leftPx}px` : undefined}
		style:top={!fullscreen ? `${topPx}px` : undefined}
		bind:this={popoverEl}
		role="dialog"
		aria-label="Choose {label} score"
	>
		<div class="popover-title">{label}</div>
		<div class="grid">
			{#each options as n (n)}
				<button type="button" class="option" class:selected={n === value} onclick={() => pick(n)}>
					{n}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.score-button {
		width: clamp(2.75rem, 6dvh, 3.5rem);
		height: clamp(2.75rem, 6dvh, 3.5rem);
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		text-align: center;
		font-size: clamp(1.05rem, 2.6dvh, 1.25rem);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.score-button.win {
		background: var(--win-bg);
		border-color: var(--win-border);
	}
	.score-button.lose {
		background: var(--lose-bg);
		border-color: var(--lose-border);
	}
	.backdrop {
		position: fixed;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.5);
		z-index: 20;
	}
	.popover {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: clamp(17rem, 90dvw, 28rem);
		max-height: min(85dvh, 42rem);
		z-index: 21;
		overflow-y: auto;
		padding: clamp(1rem, 3dvh, 1.5rem);
		display: flex;
		flex-direction: column;
		gap: clamp(0.6rem, 2dvh, 1rem);
		/* Anchored placement (left/top px) is applied inline once measured; hide the jump from the
		   default centered fallback to the real position instead of letting it flash on screen. */
		visibility: hidden;
	}
	.popover.positioned {
		visibility: visible;
	}
	.popover:not(.fullscreen) {
		top: 0;
		left: 0;
		transform: none;
	}
	.popover.fullscreen {
		inset: 0;
		top: 0;
		left: 0;
		transform: none;
		width: 100dvw;
		height: 100dvh;
		max-height: none;
		border-radius: 0;
		justify-content: center;
		visibility: visible;
	}
	.popover-title {
		text-align: center;
		font-weight: 600;
		font-size: clamp(0.95rem, 2.4dvh, 1.1rem);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: clamp(0.4rem, 1.2dvh, 0.6rem);
	}
	.fullscreen .grid {
		gap: clamp(0.5rem, 1.6dvh, 0.75rem);
	}
	.option {
		aspect-ratio: 1;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--court-panel);
		color: var(--text);
		font-size: clamp(0.9rem, 2.2dvh, 1.1rem);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.option.selected {
		border-color: var(--primary);
		background: color-mix(in srgb, var(--primary) 25%, var(--court-panel));
	}
</style>
