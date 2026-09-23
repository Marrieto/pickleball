import { describe, expect, test } from 'vitest';
import { computePartnerCounts, generateFinalRoundPlan, generateRound, partnerKey } from './pairing';
import type { CourtMatch, PlayerStanding, Round } from './types';

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

describe('generateRound - mexicano pairingStyle option', () => {
	test('pairingStyle "alternate" pairs 1st+3rd vs 2nd+4th instead of the default 1st+4th vs 2nd+3rd', () => {
		const standings = [
			player({ id: 'P1', totalPoints: 40 }),
			player({ id: 'P2', totalPoints: 30 }),
			player({ id: 'P3', totalPoints: 20 }),
			player({ id: 'P4', totalPoints: 10 })
		];

		const plan = generateRound(standings, 1, { pairingStyle: 'alternate' });

		expect(new Set(plan.courts[0].teamA)).toEqual(new Set(['P1', 'P3']));
		expect(new Set(plan.courts[0].teamB)).toEqual(new Set(['P2', 'P4']));
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

function round(overrides: Partial<Round> & { courts: CourtMatch[] }): Round {
	return {
		id: 'r',
		roundNumber: 1,
		sittingOut: [],
		benchedPlayerIds: [],
		createdAt: 0,
		...overrides
	};
}

describe('partnerKey', () => {
	test('is order-independent', () => {
		expect(partnerKey('A', 'B')).toBe(partnerKey('B', 'A'));
	});
});

describe('computePartnerCounts', () => {
	test('counts teamA and teamB pairs as partners, not cross-team pairs', () => {
		const rounds = [
			round({
				courts: [{ court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'] }]
			})
		];

		const counts = computePartnerCounts(rounds);

		expect(counts.get(partnerKey('A', 'B'))).toBe(1);
		expect(counts.get(partnerKey('C', 'D'))).toBe(1);
		expect(counts.get(partnerKey('A', 'C'))).toBeUndefined();
		expect(counts.get(partnerKey('A', 'D'))).toBeUndefined();
	});

	test('accumulates across multiple rounds', () => {
		const rounds = [
			round({ courts: [{ court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'] }] }),
			round({ courts: [{ court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'] }] })
		];

		const counts = computePartnerCounts(rounds);

		expect(counts.get(partnerKey('A', 'B'))).toBe(2);
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
		const plan = generateRound(standings, 1, { random: () => 0 });

		expect(plan.sittingOut).toEqual(['A']);
	});
});

describe('generateRound - americano least-recently-partnered pairing', () => {
	test('avoids re-pairing players who already partnered, when an unpaired option exists', () => {
		// A+B have already partnered once; every other pair is fresh (count 0).
		const standings = [
			player({ id: 'A' }),
			player({ id: 'B' }),
			player({ id: 'C' }),
			player({ id: 'D' })
		];
		const partnerCounts = computePartnerCounts([
			round({ courts: [{ court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'] }] })
		]);

		const plan = generateRound(standings, 1, {
			format: 'americano',
			partnerCounts,
			random: () => 0
		});

		const court = plan.courts[0];
		expect(partnerCounts.get(partnerKey(court.teamA[0], court.teamA[1])) ?? 0).toBe(0);
		expect(partnerCounts.get(partnerKey(court.teamB[0], court.teamB[1])) ?? 0).toBe(0);
	});

	test('ignores totalPoints entirely - same random seed produces the same pairing regardless of standings', () => {
		const lowStakes = [
			player({ id: 'A', totalPoints: 1 }),
			player({ id: 'B', totalPoints: 1 }),
			player({ id: 'C', totalPoints: 1 }),
			player({ id: 'D', totalPoints: 1 })
		];
		const highStakes = [
			player({ id: 'A', totalPoints: 99 }),
			player({ id: 'B', totalPoints: 2 }),
			player({ id: 'C', totalPoints: 50 }),
			player({ id: 'D', totalPoints: 0 })
		];

		const planLow = generateRound(lowStakes, 1, { format: 'americano', random: () => 0 });
		const planHigh = generateRound(highStakes, 1, { format: 'americano', random: () => 0 });

		expect(planHigh.courts).toEqual(planLow.courts);
	});

	test('is deterministic under a fixed random function', () => {
		const standings = [
			player({ id: 'A' }),
			player({ id: 'B' }),
			player({ id: 'C' }),
			player({ id: 'D' })
		];

		const plan = generateRound(standings, 1, { format: 'americano', random: () => 0 });

		expect(plan.courts).toHaveLength(1);
		expect(new Set([...plan.courts[0].teamA, ...plan.courts[0].teamB])).toEqual(
			new Set(['A', 'B', 'C', 'D'])
		);
	});
});

describe('generateFinalRoundPlan', () => {
	function standing(id: string, totalPoints: number, roundsSincePlayed = 0): PlayerStanding {
		return player({ id, totalPoints, roundsSincePlayed });
	}

	test('selects exactly courtCount*4 top-ranked players, ignoring rest priority', () => {
		// H is the least-rested (roundsSincePlayed 99) but ranks last by points - must still sit out.
		const standings = [
			standing('A', 80),
			standing('B', 70),
			standing('C', 60),
			standing('D', 50),
			standing('E', 40),
			standing('F', 30),
			standing('G', 20),
			standing('H', 10, 99)
		];

		const plan = generateFinalRoundPlan(standings, 1, 'standard');

		expect(plan.courts).toHaveLength(1);
		const playing = new Set(plan.courts.flatMap((c: CourtMatch) => [...c.teamA, ...c.teamB]));
		expect(playing).toEqual(new Set(['A', 'B', 'C', 'D']));
		expect(plan.sittingOut).toEqual(expect.arrayContaining(['E', 'F', 'G', 'H']));
	});

	test('excludes manually benched players before ranking', () => {
		const standings = [
			player({ id: 'A', totalPoints: 100, benched: true }),
			standing('B', 90),
			standing('C', 80),
			standing('D', 70),
			standing('E', 60)
		];

		const plan = generateFinalRoundPlan(standings, 1, 'standard');

		expect(plan.courts.flatMap((c: CourtMatch) => [...c.teamA, ...c.teamB])).not.toContain('A');
		expect(plan.sittingOut).toContain('A');
	});

	test('standard style pairs 1st+4th vs 2nd+3rd', () => {
		const standings = [standing('P1', 40), standing('P2', 30), standing('P3', 20), standing('P4', 10)];

		const plan = generateFinalRoundPlan(standings, 1, 'standard');

		expect(new Set(plan.courts[0].teamA)).toEqual(new Set(['P1', 'P4']));
		expect(new Set(plan.courts[0].teamB)).toEqual(new Set(['P2', 'P3']));
	});

	test('alternate style pairs 1st+3rd vs 2nd+4th', () => {
		const standings = [standing('P1', 40), standing('P2', 30), standing('P3', 20), standing('P4', 10)];

		const plan = generateFinalRoundPlan(standings, 1, 'alternate');

		expect(new Set(plan.courts[0].teamA)).toEqual(new Set(['P1', 'P3']));
		expect(new Set(plan.courts[0].teamB)).toEqual(new Set(['P2', 'P4']));
	});

	test('falls back to fewer courts when not enough players remain', () => {
		const standings = [standing('A', 40), standing('B', 30), standing('C', 20), standing('D', 10), standing('E', 5)];

		const plan = generateFinalRoundPlan(standings, 2, 'standard');

		expect(plan.courts).toHaveLength(1);
		expect(plan.sittingOut).toHaveLength(1);
	});
});
