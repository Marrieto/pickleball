import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	addPlayer,
	createTournament,
	editRoundAssignment,
	generateFinalRound,
	generateNextRound,
	goToRound,
	recordScore,
	removePlayer,
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
		expect(tournament.settings.finalRoundPairingStyle).toBe('standard');
	});

	test('honors settings overrides', () => {
		const tournament = createTournament('T', 1, 21, {
			pairingFormat: 'americano',
			scoringMode: 'bestOf',
			finalRoundPairingStyle: 'alternate'
		});

		expect(tournament.settings.pairingFormat).toBe('americano');
		expect(tournament.settings.scoringMode).toBe('bestOf');
		expect(tournament.settings.finalRoundPairingStyle).toBe('alternate');
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

describe('generateFinalRound', () => {
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
