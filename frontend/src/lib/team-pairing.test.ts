import { describe, expect, test } from 'vitest';
import { computeTeamStandings } from './standings';
import {
	computeOpponentCounts,
	generateTeamFinalRoundPlan,
	generateTeamRound,
	opponentKey
} from './team-pairing';
import type { Round, RoundPlan, Standing, Team } from './types';

function standing(overrides: Partial<Standing> & { id: string }): Standing {
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

/** Team `tN` is made of players `tNa` and `tNb`. */
function team(n: number): Team {
	return {
		id: `t${n}`,
		playerIds: [`t${n}a`, `t${n}b`],
		active: true,
		startingPoints: 0
	};
}

function asRound(plan: RoundPlan, roundNumber: number): Round {
	return {
		id: `round-${roundNumber}`,
		roundNumber,
		courts: plan.courts,
		sittingOut: plan.sittingOut,
		benchedPlayerIds: [],
		createdAt: 0
	};
}

function matchups(plan: RoundPlan): string[] {
	return plan.courts.map((c) => opponentKey(c.teamAId!, c.teamBId!));
}

describe('opponentKey', () => {
	test('is order independent', () => {
		expect(opponentKey('t1', 't2')).toBe(opponentKey('t2', 't1'));
	});
});

describe('computeOpponentCounts', () => {
	test('accumulates across rounds and ignores courts without team ids', () => {
		const rounds: Round[] = [
			asRound(
				{
					courts: [
						{ court: 1, teamA: ['a', 'b'], teamB: ['c', 'd'], teamAId: 't1', teamBId: 't2' },
						{ court: 2, teamA: ['e', 'f'], teamB: ['g', 'h'] }
					],
					sittingOut: []
				},
				1
			),
			asRound(
				{
					courts: [
						{ court: 1, teamA: ['c', 'd'], teamB: ['a', 'b'], teamAId: 't2', teamBId: 't1' }
					],
					sittingOut: []
				},
				2
			)
		];
		const counts = computeOpponentCounts(rounds);
		expect(counts.get(opponentKey('t1', 't2'))).toBe(2);
		expect(counts.size).toBe(1);
	});
});

describe('generateTeamRound - rank based', () => {
	test('court 1 is 1st vs 2nd and court 2 is 3rd vs 4th', () => {
		const teams = [team(1), team(2), team(3), team(4)];
		const standings = [
			standing({ id: 't3', totalPoints: 30 }),
			standing({ id: 't1', totalPoints: 40 }),
			standing({ id: 't4', totalPoints: 10 }),
			standing({ id: 't2', totalPoints: 20 })
		];

		const plan = generateTeamRound(standings, teams, 2, { format: 'mexicano' });

		expect(plan.courts).toHaveLength(2);
		expect([plan.courts[0].teamAId, plan.courts[0].teamBId]).toEqual(['t1', 't3']);
		expect([plan.courts[1].teamAId, plan.courts[1].teamBId]).toEqual(['t2', 't4']);
	});

	test('courts carry the teams own player tuples', () => {
		const teams = [team(1), team(2)];
		const standings = [standing({ id: 't1', totalPoints: 10 }), standing({ id: 't2' })];

		const plan = generateTeamRound(standings, teams, 1, { format: 'mexicano' });

		expect(plan.courts[0].teamA).toEqual(['t1a', 't1b']);
		expect(plan.courts[0].teamB).toEqual(['t2a', 't2b']);
	});
});

describe('generateTeamRound - rotation', () => {
	test('four teams over three rounds play a complete round robin, no rematches', () => {
		const teams = [team(1), team(2), team(3), team(4)];
		const standings = teams.map((t) => standing({ id: t.id }));

		const history: Round[] = [];
		const seen: string[] = [];
		for (let i = 1; i <= 3; i++) {
			const plan = generateTeamRound(standings, teams, 2, {
				format: 'americano',
				opponentCounts: computeOpponentCounts(history)
			});
			expect(plan.courts).toHaveLength(2);
			seen.push(...matchups(plan));
			history.push(asRound(plan, i));
		}

		// All six possible matchups, each exactly once.
		expect(new Set(seen).size).toBe(6);
		expect(seen).toHaveLength(6);
	});

	test('avoids a rematch when an unfaced opponent is available', () => {
		const teams = [team(1), team(2), team(3), team(4)];
		const standings = teams.map((t) => standing({ id: t.id }));
		const opponentCounts = new Map([[opponentKey('t1', 't2'), 1]]);

		for (let i = 0; i < 20; i++) {
			const plan = generateTeamRound(standings, teams, 2, { format: 'americano', opponentCounts });
			expect(matchups(plan)).not.toContain(opponentKey('t1', 't2'));
		}
	});

	test('ignores standings entirely', () => {
		const teams = [team(1), team(2), team(3), team(4)];
		const flat = teams.map((t) => standing({ id: t.id }));
		const skewed = [
			standing({ id: 't1', totalPoints: 99 }),
			standing({ id: 't2', totalPoints: 70 }),
			standing({ id: 't3', totalPoints: 40 }),
			standing({ id: 't4', totalPoints: 1 })
		];
		const seeded = () => {
			let n = 0;
			return () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
		};

		const a = generateTeamRound(flat, teams, 2, { format: 'americano', random: seeded() });
		const b = generateTeamRound(skewed, teams, 2, { format: 'americano', random: seeded() });
		expect(matchups(a)).toEqual(matchups(b));
	});
});

describe('generateTeamRound - rest priority and sit-outs', () => {
	test('the most rested teams play and sitting out holds team ids', () => {
		const teams = [team(1), team(2), team(3)];
		const standings = [
			standing({ id: 't1', roundsSincePlayed: 0 }),
			standing({ id: 't2', roundsSincePlayed: 3 }),
			standing({ id: 't3', roundsSincePlayed: 2 })
		];

		const plan = generateTeamRound(standings, teams, 2, { format: 'mexicano' });

		expect(plan.courts).toHaveLength(1);
		expect(plan.sittingOut).toEqual(['t1']);
	});

	test('benched teams are excluded even when they are the most rested', () => {
		const teams = [team(1), team(2), team(3)];
		const standings = [
			standing({ id: 't1', roundsSincePlayed: 10, benched: true }),
			standing({ id: 't2' }),
			standing({ id: 't3' })
		];

		const plan = generateTeamRound(standings, teams, 2, { format: 'mexicano' });

		expect(plan.sittingOut).toEqual(['t1']);
		expect(matchups(plan)).toEqual([opponentKey('t2', 't3')]);
	});

	test('degrades to the courts it can fill', () => {
		const teams = [team(1), team(2)];
		const standings = teams.map((t) => standing({ id: t.id }));
		expect(generateTeamRound(standings, teams, 4, {}).courts).toHaveLength(1);
	});
});

describe('generateTeamFinalRoundPlan', () => {
	test('top teams play 1v2 and 3v4, the rest sit out', () => {
		const teams = [team(1), team(2), team(3), team(4), team(5), team(6)];
		const standings = [
			standing({ id: 't5', totalPoints: 10 }),
			standing({ id: 't1', totalPoints: 60 }),
			standing({ id: 't3', totalPoints: 40 }),
			standing({ id: 't6', totalPoints: 5 }),
			standing({ id: 't2', totalPoints: 50 }),
			standing({ id: 't4', totalPoints: 30 })
		];

		const plan = generateTeamFinalRoundPlan(standings, teams, 2);

		expect([plan.courts[0].teamAId, plan.courts[0].teamBId]).toEqual(['t1', 't2']);
		expect([plan.courts[1].teamAId, plan.courts[1].teamBId]).toEqual(['t3', 't4']);
		expect(plan.sittingOut.sort()).toEqual(['t5', 't6']);
	});

	test('benched teams never reach the final', () => {
		const teams = [team(1), team(2), team(3)];
		const standings = [
			standing({ id: 't1', totalPoints: 99, benched: true }),
			standing({ id: 't2', totalPoints: 50 }),
			standing({ id: 't3', totalPoints: 40 })
		];

		const plan = generateTeamFinalRoundPlan(standings, teams, 2);

		expect([plan.courts[0].teamAId, plan.courts[0].teamBId]).toEqual(['t2', 't3']);
		expect(plan.sittingOut).toEqual(['t1']);
	});
});

describe('rest fairness', () => {
	/** Plays a full night and returns how many rounds each team sat out. */
	function simulate(
		teamCount: number,
		courtCount: number,
		roundCount: number,
		format: 'mexicano' | 'americano'
	): number[] {
		const teams = [...Array(teamCount)].map((_, i) => team(i + 1));
		const history: Round[] = [];

		for (let r = 1; r <= roundCount; r++) {
			const standings = computeTeamStandings(teams, history);
			const plan = generateTeamRound(standings, teams, courtCount, {
				format,
				opponentCounts: computeOpponentCounts(history)
			});
			// Every match scored, so standings move and rank-based pairing has something to sort on.
			plan.courts = plan.courts.map((c) => ({
				...c,
				score: { teamAPoints: 11, teamBPoints: 7 }
			}));
			history.push(asRound(plan, r));
		}

		return teams.map((t) => history.filter((rd) => rd.sittingOut.includes(t.id)).length);
	}

	// A spread of 1 is the floor whenever sit-outs don't divide evenly across teams.
	const scenarios = [
		{ teams: 5, courts: 2, label: '5 teams, 2 courts (1 sits)' },
		{ teams: 6, courts: 2, label: '6 teams, 2 courts (2 sit)' },
		{ teams: 7, courts: 3, label: '7 teams, 3 courts (1 sits)' },
		{ teams: 9, courts: 2, label: '9 teams, 2 courts (5 sit)' }
	];

	for (const { teams: teamCount, courts, label } of scenarios) {
		for (const format of ['mexicano', 'americano'] as const) {
			test(`${format}: no team rests more than one round beyond any other — ${label}`, () => {
				for (let trial = 0; trial < 15; trial++) {
					const satOut = simulate(teamCount, courts, 15, format);
					expect(Math.max(...satOut) - Math.min(...satOut)).toBeLessThanOrEqual(1);
				}
			});
		}
	}

	test('a team that joins late is caught up on games played, not left behind', () => {
		const established = [1, 2, 3, 4, 5].map((n) => team(n));
		const latecomer = team(6);
		const history: Round[] = [];

		for (let r = 1; r <= 48; r++) {
			// The sixth team only exists from round 9 onwards.
			const roster = r > 8 ? [...established, latecomer] : established;
			const standings = computeTeamStandings(roster, history);
			const plan = generateTeamRound(standings, roster, 2, { format: 'americano' });
			history.push(asRound(plan, r));
		}

		const roster = [...established, latecomer];
		const games = computeTeamStandings(roster, history).map((s) => s.gamesPlayed);
		expect(Math.max(...games) - Math.min(...games)).toBeLessThanOrEqual(1);
	});
});
