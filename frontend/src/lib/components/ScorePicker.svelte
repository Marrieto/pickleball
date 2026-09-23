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

	let open = $state(false);
	let options = $derived(Array.from({ length: max + 1 }, (_, n) => n));

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
	aria-label="{label} score, currently {value}. Tap to change."
	onclick={() => (open = true)}
>
	{value}
</button>

{#if open}
	<button class="backdrop" aria-label="Close score picker" onclick={() => (open = false)}></button>
	<div class="popover card" role="dialog" aria-label="Choose {label} score">
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
		width: 3.5rem;
		height: 3.5rem;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		text-align: center;
		font-size: 1.25rem;
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
		inset: 10vh 5vw;
		z-index: 21;
		overflow-y: auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.popover-title {
		text-align: center;
		font-weight: 600;
		font-size: 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3.5rem, 1fr));
		gap: 0.6rem;
	}
	.option {
		aspect-ratio: 1;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--court-panel);
		color: var(--text);
		font-size: 1.15rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.option.selected {
		border-color: var(--primary);
		background: color-mix(in srgb, var(--primary) 25%, var(--court-panel));
	}
</style>
