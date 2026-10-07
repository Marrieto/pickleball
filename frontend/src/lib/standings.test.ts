import { describe, expect, test } from 'vitest';
import { computeStandings, computeTeamStandings, rankStandings } from './standings';
import type { Player, PlayerStanding, Round, Team } from './types';

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
	test('ranks by adjusted score first, even when another player has more total points', () => {
		const standings = [
			standing({ id: 'A', totalPoints: 20, adjustedScore: 5 }),
			standing({ id: 'B', totalPoints: 30, adjustedScore: 3 })
		];

		const ranked = rankStandings(standings);

		expect(ranked.map((s) => s.id)).toEqual(['A', 'B']);
	});

	test('breaks a tie in adjusted score with the most rounds played', () => {
		const standings = [
			standing({ id: 'Cameo', totalPoints: 11, adjustedScore: 11, gamesPlayed: 1 }),
			standing({ id: 'AllNight', totalPoints: 66, adjustedScore: 11, gamesPlayed: 6 })
		];

		expect(rankStandings(standings).map((s) => s.id)).toEqual(['AllNight', 'Cameo']);
	});

	test('a handicap cannot buy a tiebreak over someone who played more', () => {
		const standings = [
			// 58-point handicap plus one 11-point win.
			standing({ id: 'Late', totalPoints: 69, adjustedScore: 11, gamesPlayed: 1 }),
			standing({ id: 'Regular', totalPoints: 66, adjustedScore: 11, gamesPlayed: 6 })
		];

		expect(rankStandings(standings).map((s) => s.id)).toEqual(['Regular', 'Late']);
	});

	test('falls through to total points when adjusted score and games played both tie', () => {
		const standings = [
			standing({ id: 'Four', totalPoints: 41, adjustedScore: 6.8, gamesPlayed: 6 }),
			standing({ id: 'Waitman', totalPoints: 55, adjustedScore: 6.8, gamesPlayed: 6 })
		];

		expect(rankStandings(standings).map((s) => s.id)).toEqual(['Waitman', 'Four']);
	});
});

describe('adjusted score and the mid-session handicap', () => {
	test('the handicap counts toward total points but is left out of the average', () => {
		const players = [player('late', 'Late', 58), player('reg', 'Reg')];
		const rounds = [
			round({
				roundNumber: 1,
				courts: [
					{
						court: 1,
						teamA: ['late', 'x'],
						teamB: ['reg', 'y'],
						score: { teamAPoints: 11, teamBPoints: 9 }
					}
				]
			})
		];

		const [late, reg] = computeStandings(players, rounds);

		expect(late.totalPoints).toBe(69);
		expect(late.adjustedScore).toBe(11);
		expect(reg.adjustedScore).toBe(9);
		// Without excluding the handicap this would be 69, handing a one-game newcomer the night.
		expect(rankStandings([late, reg]).map((s) => s.id)).toEqual(['late', 'reg']);
	});
});

function team(id: string, a: string, b: string, startingPoints = 0): Team {
	return { id, playerIds: [a, b], active: true, startingPoints };
}

describe('computeTeamStandings', () => {
	const teams = [team('t1', 'a', 'b'), team('t2', 'c', 'd')];

	const played = round({
		roundNumber: 1,
		courts: [
			{
				court: 1,
				teamA: ['a', 'b'],
				teamB: ['c', 'd'],
				teamAId: 't1',
				teamBId: 't2',
				score: { teamAPoints: 11, teamBPoints: 7 }
			}
		]
	});

	test('accumulates each team own points, wins and games', () => {
		const [t1, t2] = computeTeamStandings(teams, [played]);
		expect(t1).toMatchObject({ id: 't1', totalPoints: 11, wins: 1, gamesPlayed: 1 });
		expect(t2).toMatchObject({ id: 't2', totalPoints: 7, wins: 0, gamesPlayed: 1 });
	});

	test('seeds totalPoints from the team starting offset', () => {
		const [t1] = computeTeamStandings([team('t1', 'a', 'b', 5), teams[1]], [played]);
		expect(t1.totalPoints).toBe(16);
	});

	test('counts sit-outs by team id', () => {
		const rounds = [played, round({ roundNumber: 2, sittingOut: ['t2'] })];
		const [t1, t2] = computeTeamStandings(teams, rounds);
		expect(t1.timesSatOut).toBe(0);
		expect(t2.timesSatOut).toBe(1);
	});

	test('tracks roundsSincePlayed across rounds the team missed', () => {
		const rounds = [played, round({ roundNumber: 2, sittingOut: ['t1', 't2'] })];
		const [t1] = computeTeamStandings(teams, rounds);
		expect(t1.roundsSincePlayed).toBe(1);
	});

	test('a court without team ids contributes nothing, even when the same players are on it', () => {
		const individualRound = round({
			roundNumber: 1,
			courts: [
				{
					court: 1,
					teamA: ['a', 'b'],
					teamB: ['c', 'd'],
					score: { teamAPoints: 11, teamBPoints: 7 }
				}
			]
		});
		const [t1] = computeTeamStandings(teams, [individualRound]);
		expect(t1).toMatchObject({ totalPoints: 0, gamesPlayed: 0, wins: 0 });
	});
});
