<!--
  Draws the net + kitchen (non-volley zone) lines as real elements sandwiched
  between the two team rows, instead of guessing their position inside a
  stretched background image - this stays correctly placed no matter how
  tall the surrounding content ends up being.
-->
<div class="net-zone">
	<div class="kitchen-line"></div>
	<div class="net-line"></div>
	<div class="kitchen-line"></div>
</div>

<style>
	.net-zone {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.85rem;
	}
	.kitchen-line {
		height: 1px;
		background: var(--court-line);
		margin: 0 0.5rem;
	}
	.net-line {
		height: 0;
		margin: 0 0.15rem;
		border-top: 4px dotted var(--court-line);
	}
</style>
