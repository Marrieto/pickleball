import { describe, expect, test } from 'vitest';
import {
	addPlayer,
	createTournament,
	editRoundAssignment,
	generateNextRound,
	goToRound,
	recordScore,
	removePlayer,
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

describe('goToRound', () => {
	test('clamps navigation within the available round indexes', () => {
		let state = generateNextRound(withPlayers(4, 1));
		state = generateNextRound(state);

		expect(goToRound(state.tournament, -5).currentRoundIndex).toBe(0);
		expect(goToRound(state.tournament, 0).currentRoundIndex).toBe(0);
		expect(goToRound(state.tournament, 99).currentRoundIndex).toBe(1);
	});
});
