import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	addPlayer,
	createTeam,
	createTournament,
	disbandTeam,
	editRoundAssignment,
	generateFinalRound,
	generateNextRound,
	goToRound,
	recordScore,
	removePlayer,
	renameTeam,
	setCourtLabel,
	togglePendingBench,
	undoLastAction
} from './tournament-actions';
import type { CourtMatch, TournamentActionsState } from './types';

function withPlayers(count: number, courtCount: number): TournamentActionsState {
	let tournament = createTournament('T', courtCount, 8);
	for (let i = 0; i < count; i++) {
		tournament = addPlayer(tournament, `P${i}`);
	}
	return { tournament, rounds: {} };
}

describe('createTournament', () => {
	test('creates an empty tournament with the given settings', () => {
		const tournament = createTournament('Friday Night', 2, 8);

		expect(tournament.name).toBe('Friday Night');
		expect(tournament.courtCount).toBe(2);
		expect(tournament.targetScore).toBe(8);
		expect(tournament.players).toEqual([]);
		expect(tournament.roundIds).toEqual([]);
	});

	test('defaults new settings to mexicano/firstTo/standard', () => {
		const tournament = createTournament('T', 1, 8);

		expect(tournament.settings.pairingFormat).toBe('mexicano');
		expect(tournament.settings.scoringMode).toBe('firstTo');
		expect(tournament.settings.pairingStyle).toBe('standard');
	});

	test('honors settings overrides', () => {
		const tournament = createTournament('T', 1, 21, {
			pairingFormat: 'americano',
			scoringMode: 'bestOf',
			pairingStyle: 'alternate'
		});

		expect(tournament.settings.pairingFormat).toBe('americano');
		expect(tournament.settings.scoringMode).toBe('bestOf');
		expect(tournament.settings.pairingStyle).toBe('alternate');
	});
});

describe('addPlayer / removePlayer', () => {
	test('addPlayer appends an active player with a unique id', () => {
		let tournament = createTournament('T', 1, 8);
		tournament = addPlayer(tournament, 'Alice');
		tournament = addPlayer(tournament, 'Bob');

		expect(tournament.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
		expect(tournament.players.every((p) => p.active)).toBe(true);
		expect(new Set(tournament.players.map((p) => p.id)).size).toBe(2);
	});

	test('addPlayer sets startingPoints from the 3rd arg, defaulting to 0', () => {
		let tournament = createTournament('T', 1, 8);
		tournament = addPlayer(tournament, 'Alice', 5);
		tournament = addPlayer(tournament, 'Bob');

		expect(tournament.players[0].startingPoints).toBe(5);
		expect(tournament.players[1].startingPoints).toBe(0);
	});

	test('removePlayer marks a player inactive without deleting their history record', () => {
		let tournament = createTournament('T', 1, 8);
		tournament = addPlayer(tournament, 'Alice');
		const aliceId = tournament.players[0].id;

		tournament = removePlayer(tournament, aliceId);

		expect(tournament.players).toHaveLength(1);
		expect(tournament.players[0].active).toBe(false);
	});
});

describe('generateNextRound', () => {
	test('creates a round assigning every active player and clears pending benches', () => {
		const state = withPlayers(4, 1);

		const next = generateNextRound(state);

		expect(next.tournament.roundIds).toHaveLength(1);
		expect(next.tournament.currentRoundIndex).toBe(0);
		expect(next.tournament.pendingBenchIds).toEqual([]);

		const round = next.rounds[next.tournament.roundIds[0]];
		expect(round.courts).toHaveLength(1);
		expect(round.sittingOut).toEqual([]);
	});

	test('a player toggled into pendingBenchIds sits out the generated round', () => {
		let state = withPlayers(5, 1);
		const benchedId = state.tournament.players[0].id;
		state.tournament = togglePendingBench(state.tournament, benchedId);

		const next = generateNextRound(state);

		const round = next.rounds[next.tournament.roundIds[0]];
		expect(round.sittingOut).toContain(benchedId);
		expect(round.courts.flatMap((c: CourtMatch) => [...c.teamA, ...c.teamB])).not.toContain(
			benchedId
		);
	});
});

describe('generateNextRound - americano format wiring', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('builds partnerCounts from round history and avoids repeating a partnered pair when a fresh option exists', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);

		let state = withPlayers(8, 2);
		state.tournament = { ...state.tournament, settings: { ...state.tournament.settings, pairingFormat: 'americano' } };

		state = generateNextRound(state);
		const round1 = state.rounds[state.tournament.roundIds[0]];
		const round1Pairs = round1.courts.flatMap((c) => [
			[...c.teamA].sort().join('+'),
			[...c.teamB].sort().join('+')
		]);

		state = generateNextRound(state);
		const round2 = state.rounds[state.tournament.roundIds[1]];
		const round2Pairs = round2.courts.flatMap((c) => [
			[...c.teamA].sort().join('+'),
			[...c.teamB].sort().join('+')
		]);

		expect(round2Pairs.some((pair) => round1Pairs.includes(pair))).toBe(false);
	});
});

describe('generateNextRound - mexicano pairingStyle wiring', () => {
	test('honors tournament.settings.pairingStyle for normal Mexicano rounds', () => {
		let state = withPlayers(4, 1);
		const [p0, p1, p2, p3] = state.tournament.players.map((p) => p.id);

		// Fabricate history giving each player a distinct total: p0=14, p1=10, p2=4, p3=0.
		state.rounds = {
			r1: {
				id: 'r1',
				roundNumber: 1,
				courts: [{ court: 1, teamA: [p0, p1], teamB: [p2, p3], score: { teamAPoints: 10, teamBPoints: 0 } }],
				sittingOut: [],
				benchedPlayerIds: [],
				createdAt: 0
			},
			r2: {
				id: 'r2',
				roundNumber: 2,
				courts: [{ court: 1, teamA: [p0, p2], teamB: [p1, p3], score: { teamAPoints: 4, teamBPoints: 0 } }],
				sittingOut: [],
				benchedPlayerIds: [],
				createdAt: 0
			}
		};
		state.tournament = {
			...state.tournament,
			roundIds: ['r1', 'r2'],
			currentRoundIndex: 1,
			settings: { ...state.tournament.settings, pairingStyle: 'alternate' }
		};

		const next = generateNextRound(state);
		const court = next.rounds[next.tournament.roundIds[2]].courts[0];

		// Ranking is p0(14) > p1(10) > p2(4) > p3(0). alternate = 1st+3rd vs 2nd+4th.
		expect(new Set(court.teamA)).toEqual(new Set([p0, p2]));
		expect(new Set(court.teamB)).toEqual(new Set([p1, p3]));
	});
});

describe('generateFinalRound', () => {
	test('persists the terminal state and blocks generation and edits even while viewing history', () => {
		let state = generateNextRound(withPlayers(8, 2));
		const previousId = state.tournament.roundIds[0];
		state = recordScore(state, previousId, 1, 8, 5);
		state = generateFinalRound(state, 'standard');
		const finalId = state.tournament.roundIds[1];
		state = JSON.parse(JSON.stringify(state));
		state.tournament = goToRound(state.tournament, 0);

		expect(state.rounds[finalId].isFinal).toBe(true);
		expect(generateNextRound(state)).toBe(state);
		expect(generateFinalRound(state, 'alternate')).toBe(state);
		expect(recordScore(state, finalId, 1, 8, 0)).toBe(state);
		expect(recordScore(state, previousId, 1, 0, 8)).toBe(state);
		expect(editRoundAssignment(state, finalId, 1, ['a', 'b'], ['c', 'd'])).toBe(state);
		expect(editRoundAssignment(state, previousId, 2, ['a', 'b'], ['c', 'd'])).toBe(state);

		const undone = undoLastAction(state);
		expect(undone.tournament.currentRoundIndex).toBe(0);
		expect(undone.rounds[previousId].courts[0].score).toEqual({ teamAPoints: 8, teamBPoints: 5 });
		expect(generateNextRound(undone).tournament.roundIds).toHaveLength(2);
	});

	test('creates a round following the same shape as generateNextRound: appends, advances index, clears benches', () => {
		let state = withPlayers(4, 1);
		const benchedId = state.tournament.players[0].id;
		state.tournament = togglePendingBench(state.tournament, benchedId);

		const next = generateFinalRound(state, 'standard');

		expect(next.tournament.roundIds).toHaveLength(1);
		expect(next.tournament.currentRoundIndex).toBe(0);
		expect(next.tournament.pendingBenchIds).toEqual([]);
		const round = next.rounds[next.tournament.roundIds[0]];
		expect(round.benchedPlayerIds).toEqual([benchedId]);
	});

	test('undoLastAction reverts a final round exactly like a normal round', () => {
		let state = withPlayers(5, 1);
		const benchedId = state.tournament.players[0].id;
		state.tournament = togglePendingBench(state.tournament, benchedId);
		state = generateFinalRound(state, 'standard');
		const roundId = state.tournament.roundIds[0];

		const next = undoLastAction(state);

		expect(next.tournament.roundIds).toEqual([]);
		expect(next.rounds[roundId]).toBeUndefined();
		expect(next.tournament.currentRoundIndex).toBe(-1);
		expect(next.tournament.pendingBenchIds).toEqual([benchedId]);
	});
});

describe('recordScore / undoLastAction', () => {
	test('recordScore sets the score on the matching court', () => {
		const state = generateNextRound(withPlayers(4, 1));
		const roundId = state.tournament.roundIds[0];

		const next = recordScore(state, roundId, 1, 8, 5);

		expect(next.rounds[roundId].courts[0].score).toEqual({ teamAPoints: 8, teamBPoints: 5 });
	});

	test('undoLastAction reverts the most recently recorded score', () => {
		let state = generateNextRound(withPlayers(4, 1));
		const roundId = state.tournament.roundIds[0];
		state = recordScore(state, roundId, 1, 8, 5);

		const next = undoLastAction(state);

		expect(next.rounds[roundId].courts[0].score).toBeUndefined();
	});

	test('undoLastAction reverts the most recently generated round, restoring pending benches', () => {
		let state = withPlayers(5, 1);
		const benchedId = state.tournament.players[0].id;
		state.tournament = togglePendingBench(state.tournament, benchedId);
		state = generateNextRound(state);
		const roundId = state.tournament.roundIds[0];

		const next = undoLastAction(state);

		expect(next.tournament.roundIds).toEqual([]);
		expect(next.rounds[roundId]).toBeUndefined();
		expect(next.tournament.currentRoundIndex).toBe(-1);
		expect(next.tournament.pendingBenchIds).toEqual([benchedId]);
	});
});

describe('editRoundAssignment', () => {
	test('swaps two players between slots before the round has any score recorded', () => {
		const state = generateNextRound(withPlayers(4, 1));
		const roundId = state.tournament.roundIds[0];
		const round = state.rounds[roundId];
		const [p1, p4] = round.courts[0].teamA;
		const [p2, p3] = round.courts[0].teamB;

		const next = editRoundAssignment(state, roundId, 1, [p2, p4], [p1, p3]);

		expect(next.rounds[roundId].courts[0].teamA).toEqual([p2, p4]);
		expect(next.rounds[roundId].courts[0].teamB).toEqual([p1, p3]);
	});

	test('does nothing once the court already has a recorded score', () => {
		let state = generateNextRound(withPlayers(4, 1));
		const roundId = state.tournament.roundIds[0];
		state = recordScore(state, roundId, 1, 8, 5);
		const before = state.rounds[roundId].courts[0];

		const next = editRoundAssignment(state, roundId, 1, ['x', 'y'], ['z', 'w']);

		expect(next.rounds[roundId].courts[0]).toEqual(before);
	});
});

describe('setCourtLabel', () => {
	test('sets a label for one side of one court, leaving other courts/sides untouched', () => {
		let tournament = createTournament('T', 2, 8);

		tournament = setCourtLabel(tournament, 1, 'teamA', 'Glasvägg');

		expect(tournament.courtLabels[1]?.teamA).toBe('Glasvägg');
		expect(tournament.courtLabels[1]?.teamB).toBeUndefined();
		expect(tournament.courtLabels[2]).toBeUndefined();
	});

	test('a court can have independent labels for each side', () => {
		let tournament = createTournament('T', 1, 8);

		tournament = setCourtLabel(tournament, 1, 'teamA', 'Glasvägg');
		tournament = setCourtLabel(tournament, 1, 'teamB', 'Betongvägg');

		expect(tournament.courtLabels[1]).toEqual({ teamA: 'Glasvägg', teamB: 'Betongvägg' });
	});

	test('setting an empty or whitespace-only label clears it, keeping labels optional', () => {
		let tournament = createTournament('T', 1, 8);
		tournament = setCourtLabel(tournament, 1, 'teamA', 'Glasvägg');

		tournament = setCourtLabel(tournament, 1, 'teamA', '   ');

		expect(tournament.courtLabels[1]?.teamA).toBeUndefined();
	});
});

describe('goToRound', () => {
	test('clamps navigation within the available round indexes', () => {
		let state = generateNextRound(withPlayers(4, 1));
		state = generateNextRound(state);

		expect(goToRound(state.tournament, -5).currentRoundIndex).toBe(0);
		expect(goToRound(state.tournament, 0).currentRoundIndex).toBe(0);
		expect(goToRound(state.tournament, 99).currentRoundIndex).toBe(1);
	});
});

function teamTournament(playerCount: number, courtCount: number): TournamentActionsState {
	let tournament = createTournament('T', courtCount, 8, { entryMode: 'teams' });
	for (let i = 0; i < playerCount; i++) tournament = addPlayer(tournament, `P${i}`);
	return { tournament, rounds: {} };
}

/** Pairs players up two at a time: P0+P1, P2+P3, ... */
function pairAll(state: TournamentActionsState): TournamentActionsState {
	let { tournament } = state;
	const ids = tournament.players.filter((p) => p.active).map((p) => p.id);
	for (let i = 0; i + 1 < ids.length; i += 2) {
		tournament = createTeam(tournament, ids[i], ids[i + 1]);
	}
	return { ...state, tournament };
}

describe('teams mode - defaults and CRUD', () => {
	test('a new tournament defaults to individual mode with no teams', () => {
		const tournament = createTournament('T', 2, 11);
		expect(tournament.settings.entryMode).toBe('individual');
		expect(tournament.teams).toEqual([]);
	});

	test('createTeam refuses a player who is already on an active team', () => {
		const { tournament } = teamTournament(4, 1);
		const [p0, p1, p2] = tournament.players.map((p) => p.id);
		const once = createTeam(tournament, p0, p1);
		const twice = createTeam(once, p0, p2);
		expect(twice.teams).toHaveLength(1);
	});

	test('createTeam refuses an inactive player and refuses pairing someone with themselves', () => {
		const { tournament } = teamTournament(4, 1);
		const [p0, p1] = tournament.players.map((p) => p.id);
		expect(createTeam(tournament, p0, p0).teams).toEqual([]);
		expect(createTeam(removePlayer(tournament, p1), p0, p1).teams).toEqual([]);
	});

	test('disbandTeam soft-deletes and clears the team from pending benches', () => {
		let { tournament } = teamTournament(4, 1);
		const [p0, p1] = tournament.players.map((p) => p.id);
		tournament = createTeam(tournament, p0, p1);
		const teamId = tournament.teams[0].id;
		tournament = togglePendingBench(tournament, teamId);
		tournament = disbandTeam(tournament, teamId);

		expect(tournament.teams[0].active).toBe(false);
		expect(tournament.pendingBenchIds).not.toContain(teamId);
	});

	test('renameTeam sets and clears a custom name', () => {
		let { tournament } = teamTournament(2, 1);
		const [p0, p1] = tournament.players.map((p) => p.id);
		tournament = createTeam(tournament, p0, p1);
		const teamId = tournament.teams[0].id;
		expect(renameTeam(tournament, teamId, ' Dinkers ').teams[0].name).toBe('Dinkers');
		expect(renameTeam(tournament, teamId, '   ').teams[0].name).toBeUndefined();
	});

	test('removing a player disbands their team, freeing the partner', () => {
		let { tournament } = teamTournament(4, 1);
		const [p0, p1] = tournament.players.map((p) => p.id);
		tournament = createTeam(tournament, p0, p1);
		tournament = removePlayer(tournament, p1);

		expect(tournament.teams[0].active).toBe(false);
		expect(tournament.players.find((p) => p.id === p0)!.active).toBe(true);
	});
});

describe('teams mode - round generation', () => {
	test('generating is blocked while a player has no partner', () => {
		const state = pairAll(teamTournament(5, 2));
		expect(generateNextRound(state)).toBe(state);
		expect(generateFinalRound(state, 'standard')).toBe(state);
	});

	test('generating is blocked with fewer than two teams', () => {
		const state = pairAll(teamTournament(2, 1));
		expect(generateNextRound(state)).toBe(state);
	});

	test('a team round stores both team ids on every court', () => {
		const state = pairAll(teamTournament(8, 2));
		const result = generateNextRound(state);
		const round = result.rounds[result.tournament.roundIds[0]];

		expect(round.courts).toHaveLength(2);
		for (const court of round.courts) {
			expect(court.teamAId).toBeDefined();
			expect(court.teamBId).toBeDefined();
		}
	});

	test('a court pairs two whole teams, never splitting one', () => {
		const state = pairAll(teamTournament(8, 2));
		const result = generateNextRound(state);
		const round = result.rounds[result.tournament.roundIds[0]];
		const byId = new Map(state.tournament.teams.map((t) => [t.id, t]));

		for (const court of round.courts) {
			expect(court.teamA).toEqual(byId.get(court.teamAId!)!.playerIds);
			expect(court.teamB).toEqual(byId.get(court.teamBId!)!.playerIds);
		}
	});

	test('sitting out holds team ids, and a benched team is excluded', () => {
		let state = pairAll(teamTournament(12, 2));
		const benchedTeamId = state.tournament.teams[0].id;
		state = { ...state, tournament: togglePendingBench(state.tournament, benchedTeamId) };

		const result = generateNextRound(state);
		const round = result.rounds[result.tournament.roundIds[0]];

		expect(round.sittingOut).toContain(benchedTeamId);
		expect(round.courts.flatMap((c) => [c.teamAId, c.teamBId])).not.toContain(benchedTeamId);
	});

	test('the team final seeds the top two teams onto court 1', () => {
		let state = pairAll(teamTournament(8, 2));
		state = generateNextRound(state);
		const firstRoundId = state.tournament.roundIds[0];
		state = recordScore(state, firstRoundId, 1, 8, 2);

		const result = generateFinalRound(state, 'standard');
		const final = result.rounds[result.tournament.roundIds.at(-1)!];
		const winner = state.rounds[firstRoundId].courts[0].teamAId;

		expect(final.isFinal).toBe(true);
		expect(final.courts[0].teamAId).toBe(winner);
	});

	test('undo after a team round restores pending benches holding team ids', () => {
		let state = pairAll(teamTournament(12, 2));
		const benchedTeamId = state.tournament.teams[0].id;
		state = { ...state, tournament: togglePendingBench(state.tournament, benchedTeamId) };
		state = generateNextRound(state);
		expect(state.tournament.pendingBenchIds).toEqual([]);

		const undone = undoLastAction(state);
		expect(undone.tournament.pendingBenchIds).toEqual([benchedTeamId]);
		expect(undone.tournament.roundIds).toEqual([]);
	});

	test('editRoundAssignment moves the team ids along with the players', () => {
		let state = pairAll(teamTournament(8, 2));
		state = generateNextRound(state);
		const roundId = state.tournament.roundIds[0];
		const [courtOne, courtTwo] = state.rounds[roundId].courts;

		const result = editRoundAssignment(
			state,
			roundId,
			1,
			courtTwo.teamA,
			courtOne.teamB,
			{ teamAId: courtTwo.teamAId, teamBId: courtOne.teamBId }
		);
		const updated = result.rounds[roundId].courts[0];

		expect(updated.teamAId).toBe(courtTwo.teamAId);
		expect(updated.teamA).toEqual(courtTwo.teamA);
		expect(updated.teamBId).toBe(courtOne.teamBId);
	});
});
