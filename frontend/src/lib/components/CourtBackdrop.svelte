<svg
	class="court-backdrop"
	viewBox="0 0 100 100"
	preserveAspectRatio="none"
	aria-hidden="true"
	focusable="false"
>
	<rect x="0" y="0" width="100" height="100" fill="var(--court-fill)" />
	<rect
		x="2"
		y="2"
		width="96"
		height="96"
		rx="3"
		fill="none"
		stroke="var(--court-line)"
		stroke-width="1.2"
	/>
</svg>

<style>
	.court-backdrop {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}
</style>
