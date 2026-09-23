import { describe, expect, test } from 'vitest';
import { computeStandings, rankStandings } from './standings';
import type { Player, PlayerStanding, Round } from './types';

function player(id: string, name = id, startingPoints = 0): Player {
	return { id, name, active: true, startingPoints };
}

function round(overrides: Partial<Round> & { roundNumber: number }): Round {
	return {
		id: `round-${overrides.roundNumber}`,
		courts: [],
		sittingOut: [],
		benchedPlayerIds: [],
		createdAt: 0,
		...overrides
	};
}

describe('computeStandings - rest tracking', () => {
	test('a player who played the most recent round has roundsSincePlayed 0', () => {
		const players = [player('A'), player('B')];
		const rounds = [
			round({
				roundNumber: 1,
				courts: [{ court: 1, teamA: ['A', 'B'], teamB: ['A', 'B'] }]
			})
		];

		const standings = computeStandings(players, rounds);

		expect(standings.find((s) => s.id === 'A')?.roundsSincePlayed).toBe(0);
	});

	test('a player who sat out the most recent round but played before has roundsSincePlayed counting the gap', () => {
		const players = [player('A')];
		const rounds = [
			round({ roundNumber: 1, courts: [{ court: 1, teamA: ['A', 'x'], teamB: ['y', 'z'] }] }),
			round({ roundNumber: 2, sittingOut: ['A'] }),
			round({ roundNumber: 3, sittingOut: ['A'] })
		];

		const standings = computeStandings(players, rounds);

		expect(standings.find((s) => s.id === 'A')?.roundsSincePlayed).toBe(2);
	});

	test('a player who has never played is treated as maximally rested', () => {
		const players = [player('A'), player('B')];
		const rounds = [
			round({ roundNumber: 1, courts: [{ court: 1, teamA: ['A', 'x'], teamB: ['y', 'z'] }] }),
			round({ roundNumber: 2, courts: [{ court: 1, teamA: ['A', 'x'], teamB: ['y', 'z'] }] })
		];

		const standings = computeStandings(players, rounds);

		expect(standings.find((s) => s.id === 'B')?.roundsSincePlayed).toBe(rounds.length);
	});
});

describe('computeStandings - points and games aggregation', () => {
	test('aggregates games played and each player’s own recorded points across rounds', () => {
		const players = [player('A'), player('B'), player('C'), player('D')];
		const rounds = [
			round({
				roundNumber: 1,
				courts: [
					{
						court: 1,
						teamA: ['A', 'B'],
						teamB: ['C', 'D'],
						score: { teamAPoints: 8, teamBPoints: 5 }
					}
				]
			})
		];

		const standings = computeStandings(players, rounds);

		const a = standings.find((s) => s.id === 'A')!;
		const c = standings.find((s) => s.id === 'C')!;
		expect(a.gamesPlayed).toBe(1);
		expect(a.totalPoints).toBe(8);
		expect(a.wins).toBe(1);
		expect(c.gamesPlayed).toBe(1);
		expect(c.totalPoints).toBe(5);
		expect(c.wins).toBe(0);
	});

	test('a played-but-unscored round counts as a game but adds no points', () => {
		const players = [player('A'), player('B'), player('C'), player('D')];
		const rounds = [
			round({
				roundNumber: 1,
				courts: [{ court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'] }]
			})
		];

		const standings = computeStandings(players, rounds);

		const a = standings.find((s) => s.id === 'A')!;
		expect(a.gamesPlayed).toBe(1);
		expect(a.totalPoints).toBe(0);
	});
});

describe('computeStandings - fairness (sit-outs and adjusted score)', () => {
	test('counts total rounds sat out across the whole tournament', () => {
		const players = [player('A'), player('B')];
		const rounds = [
			round({ roundNumber: 1, sittingOut: ['A'] }),
			round({ roundNumber: 2, courts: [{ court: 1, teamA: ['A', 'x'], teamB: ['y', 'z'] }] }),
			round({ roundNumber: 3, sittingOut: ['A'] })
		];

		const standings = computeStandings(players, rounds);

		expect(standings.find((s) => s.id === 'A')?.timesSatOut).toBe(2);
		expect(standings.find((s) => s.id === 'B')?.timesSatOut).toBe(0);
	});

	test('adjustedScore is points per game played, so a lower total from sitting out more still ranks fairly', () => {
		const players = [player('A'), player('B'), player('C'), player('D'), player('E'), player('F')];
		const rounds = [
			round({
				roundNumber: 1,
				sittingOut: ['E', 'F'],
				courts: [
					{
						court: 1,
						teamA: ['A', 'B'],
						teamB: ['C', 'D'],
						score: { teamAPoints: 8, teamBPoints: 4 }
					}
				]
			}),
			round({
				roundNumber: 2,
				sittingOut: ['B', 'D'],
				courts: [
					{
						court: 1,
						teamA: ['A', 'C'],
						teamB: ['E', 'F'],
						score: { teamAPoints: 4, teamBPoints: 8 }
					}
				]
			})
		];

		const standings = computeStandings(players, rounds);

		// A played both rounds: 8 + 4 = 12 points over 2 games.
		const a = standings.find((s) => s.id === 'A')!;
		expect(a.gamesPlayed).toBe(2);
		expect(a.totalPoints).toBe(12);
		expect(a.adjustedScore).toBe(6);

		// B sat out round 2, but the one game they did play was a strong one - their
		// per-game rate is higher than A's even though their total is lower.
		const b = standings.find((s) => s.id === 'B')!;
		expect(b.gamesPlayed).toBe(1);
		expect(b.totalPoints).toBe(8);
		expect(b.adjustedScore).toBe(8);
	});

	test('adjustedScore is 0 for a player who has not played any games yet', () => {
		const players = [player('A')];
		const rounds = [round({ roundNumber: 1, sittingOut: ['A'] })];

		const standings = computeStandings(players, rounds);

		expect(standings.find((s) => s.id === 'A')?.adjustedScore).toBe(0);
	});
});

describe('computeStandings - starting points', () => {
	test('a new player with starting points and no rounds has that as their total, but 0 games/adjustedScore', () => {
		const players = [player('A', 'A', 5)];

		const standings = computeStandings(players, []);

		const a = standings.find((s) => s.id === 'A')!;
		expect(a.totalPoints).toBe(5);
		expect(a.gamesPlayed).toBe(0);
		expect(a.adjustedScore).toBe(0);
	});

	test('starting points add to points earned from actually playing', () => {
		const players = [player('A', 'A', 5), player('B'), player('C'), player('D')];
		const rounds = [
			round({
				roundNumber: 1,
				courts: [
					{
						court: 1,
						teamA: ['A', 'B'],
						teamB: ['C', 'D'],
						score: { teamAPoints: 8, teamBPoints: 5 }
					}
				]
			})
		];

		const standings = computeStandings(players, rounds);

		const a = standings.find((s) => s.id === 'A')!;
		expect(a.totalPoints).toBe(13);
		expect(a.gamesPlayed).toBe(1);
	});
});

function standing(overrides: Partial<PlayerStanding> & { id: string }): PlayerStanding {
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

describe('rankStandings', () => {
	test('ranks by total points first', () => {
		const standings = [
			standing({ id: 'A', totalPoints: 20, adjustedScore: 5 }),
			standing({ id: 'B', totalPoints: 30, adjustedScore: 3 })
		];

		const ranked = rankStandings(standings);

		expect(ranked.map((s) => s.id)).toEqual(['B', 'A']);
	});

	test('breaks a tie in total points using the higher adjusted score', () => {
		const standings = [
			standing({ id: 'Waitman', totalPoints: 41, adjustedScore: 6.8 }),
			standing({ id: 'Four', totalPoints: 41, adjustedScore: 5.9 })
		];

		const ranked = rankStandings(standings);

		expect(ranked.map((s) => s.id)).toEqual(['Waitman', 'Four']);
	});
});
