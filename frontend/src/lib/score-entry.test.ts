import { describe, expect, test } from 'vitest';
import { applyScoreSelection, pickerMax } from './score-entry';

describe('applyScoreSelection - firstTo', () => {
	test('selecting team A leaves team B untouched', () => {
		const result = applyScoreSelection('firstTo', 11, 'A', 7, { teamAPoints: 2, teamBPoints: 5 });

		expect(result).toEqual({ teamAPoints: 7, teamBPoints: 5 });
	});

	test('selecting team B leaves team A untouched', () => {
		const result = applyScoreSelection('firstTo', 11, 'B', 9, { teamAPoints: 3, teamBPoints: 1 });

		expect(result).toEqual({ teamAPoints: 3, teamBPoints: 9 });
	});
});

describe('applyScoreSelection - bestOf', () => {
	test('selecting team A sets team A and auto-fills team B as max - value', () => {
		const result = applyScoreSelection('bestOf', 21, 'A', 15, { teamAPoints: 0, teamBPoints: 0 });

		expect(result).toEqual({ teamAPoints: 15, teamBPoints: 6 });
	});

	test('selecting team B sets team B and auto-fills team A as max - value (symmetric)', () => {
		const result = applyScoreSelection('bestOf', 21, 'B', 10, { teamAPoints: 15, teamBPoints: 6 });

		expect(result).toEqual({ teamAPoints: 11, teamBPoints: 10 });
	});

	test('edge value 0 fills the other team to max', () => {
		const result = applyScoreSelection('bestOf', 21, 'A', 0, { teamAPoints: 10, teamBPoints: 11 });

		expect(result).toEqual({ teamAPoints: 0, teamBPoints: 21 });
	});

	test('edge value max fills the other team to 0', () => {
		const result = applyScoreSelection('bestOf', 21, 'A', 21, { teamAPoints: 0, teamBPoints: 0 });

		expect(result).toEqual({ teamAPoints: 21, teamBPoints: 0 });
	});

	test('last tap wins across a sequence of two selections', () => {
		const afterA = applyScoreSelection('bestOf', 21, 'A', 15, { teamAPoints: 0, teamBPoints: 0 });
		const afterB = applyScoreSelection('bestOf', 21, 'B', 4, afterA);

		expect(afterB).toEqual({ teamAPoints: 17, teamBPoints: 4 });
	});
});

describe('pickerMax', () => {
	test('firstTo extends past the target so win-by-2 finishes can be recorded', () => {
		expect(pickerMax('firstTo', 11)).toBe(15);
	});

	test('bestOf is capped exactly at the target, since the pool is fixed', () => {
		expect(pickerMax('bestOf', 21)).toBe(21);
	});
});
