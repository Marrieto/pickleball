import { describe, expect, test } from 'vitest';
import { generateRound } from './pairing';
import type { CourtMatch, PlayerStanding } from './types';

function player(overrides: Partial<PlayerStanding> & { id: string }): PlayerStanding {
	return {
		gamesPlayed: 0,
		totalPoints: 0,
		wins: 0,
		roundsSincePlayed: 0,
		timesSatOut: 0,
		adjustedScore: 0,
		benched: false,
		...overrides
	};
}

describe('generateRound - rest priority selection', () => {
	test('most-rested player is always selected, ties broken by fewest games played', () => {
		const standings = [
			player({ id: 'A', roundsSincePlayed: 5, gamesPlayed: 2 }),
			player({ id: 'B', roundsSincePlayed: 1, gamesPlayed: 2 }),
			player({ id: 'C', roundsSincePlayed: 1, gamesPlayed: 1 }),
			player({ id: 'D', roundsSincePlayed: 1, gamesPlayed: 3 }),
			player({ id: 'E', roundsSincePlayed: 1, gamesPlayed: 2 })
		];

		const plan = generateRound(standings, 1);

		expect(plan.sittingOut).toEqual(['D']);
	});

	test('manually benched players are excluded even if they are the most rested', () => {
		const standings = [
			player({ id: 'A', roundsSincePlayed: 10, benched: true }),
			player({ id: 'B', roundsSincePlayed: 1 }),
			player({ id: 'C', roundsSincePlayed: 1 }),
			player({ id: 'D', roundsSincePlayed: 1 }),
			player({ id: 'E', roundsSincePlayed: 1 })
		];

		const plan = generateRound(standings, 1);

		expect(plan.sittingOut).toContain('A');
		expect(plan.courts.flatMap((c: CourtMatch) => [...c.teamA, ...c.teamB])).not.toContain('A');
	});
});

describe('generateRound - rank grouping and pairing', () => {
	test('groups selected players into courts by standing, pairing 1st+4th vs 2nd+3rd', () => {
		// 8 players, all equally rested, ranked 1st..8th by totalPoints (P1 highest).
		const standings = [
			player({ id: 'P1', totalPoints: 80 }),
			player({ id: 'P2', totalPoints: 70 }),
			player({ id: 'P3', totalPoints: 60 }),
			player({ id: 'P4', totalPoints: 50 }),
			player({ id: 'P5', totalPoints: 40 }),
			player({ id: 'P6', totalPoints: 30 }),
			player({ id: 'P7', totalPoints: 20 }),
			player({ id: 'P8', totalPoints: 10 })
		];

		const plan = generateRound(standings, 2);

		expect(plan.courts).toHaveLength(2);

		const court1 = plan.courts.find((c: CourtMatch) => c.court === 1)!;
		expect(new Set([...court1.teamA, ...court1.teamB])).toEqual(new Set(['P1', 'P2', 'P3', 'P4']));
		expect(new Set(court1.teamA)).toEqual(new Set(['P1', 'P4']));
		expect(new Set(court1.teamB)).toEqual(new Set(['P2', 'P3']));

		const court2 = plan.courts.find((c: CourtMatch) => c.court === 2)!;
		expect(new Set([...court2.teamA, ...court2.teamB])).toEqual(new Set(['P5', 'P6', 'P7', 'P8']));
		expect(new Set(court2.teamA)).toEqual(new Set(['P5', 'P8']));
		expect(new Set(court2.teamB)).toEqual(new Set(['P6', 'P7']));
	});
});

describe('generateRound - not enough players for every court', () => {
	test('falls back to fewer courts instead of forcing an uneven group', () => {
		const standings = [
			player({ id: 'A' }),
			player({ id: 'B' }),
			player({ id: 'C' }),
			player({ id: 'D' }),
			player({ id: 'E' }),
			player({ id: 'F' })
		];

		// 6 players requested across 2 courts (needs 8) - only 1 court's worth is playable.
		const plan = generateRound(standings, 2);

		expect(plan.courts).toHaveLength(1);
		expect(plan.sittingOut).toHaveLength(2);
	});
});

describe('generateRound - randomized tie-break', () => {
	test('uses the injected random function to break full ties reproducibly', () => {
		const standings = [
			player({ id: 'A' }),
			player({ id: 'B' }),
			player({ id: 'C' }),
			player({ id: 'D' }),
			player({ id: 'E' })
		];

		// A random function that always returns 0 drives a fully deterministic
		// Fisher-Yates shuffle, so the outcome is reproducible and verifiable.
		const plan = generateRound(standings, 1, () => 0);

		expect(plan.sittingOut).toEqual(['A']);
	});
});
