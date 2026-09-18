import { generateRound } from './pairing';
import { makeId } from './id';
import { computeStandings } from './standings';
import type { Round, Tournament, TournamentActionsState } from './types';

export function createTournament(name: string, courtCount: number, targetScore: number): Tournament {
	return {
		id: makeId(),
		name,
		courtCount,
		targetScore,
		players: [],
		roundIds: [],
		currentRoundIndex: -1,
		pendingBenchIds: [],
		settings: { darkMode: false },
		createdAt: Date.now()
	};
}

export function addPlayer(tournament: Tournament, name: string): Tournament {
	return {
		...tournament,
		players: [...tournament.players, { id: makeId(), name, active: true }]
	};
}

export function removePlayer(tournament: Tournament, playerId: string): Tournament {
	return {
		...tournament,
		players: tournament.players.map((p) => (p.id === playerId ? { ...p, active: false } : p)),
		pendingBenchIds: tournament.pendingBenchIds.filter((id) => id !== playerId)
	};
}

export function togglePendingBench(tournament: Tournament, playerId: string): Tournament {
	const benched = tournament.pendingBenchIds.includes(playerId);
	return {
		...tournament,
		pendingBenchIds: benched
			? tournament.pendingBenchIds.filter((id) => id !== playerId)
			: [...tournament.pendingBenchIds, playerId]
	};
}

export function generateNextRound(state: TournamentActionsState): TournamentActionsState {
	const { tournament, rounds } = state;
	const roundHistory = tournament.roundIds.map((id) => rounds[id]);
	const activePlayers = tournament.players.filter((p) => p.active);

	const standings = computeStandings(activePlayers, roundHistory).map(
		(s) => ({ ...s, benched: tournament.pendingBenchIds.includes(s.id) })
	);

	const plan = generateRound(standings, tournament.courtCount);

	const round: Round = {
		id: makeId(),
		roundNumber: roundHistory.length + 1,
		courts: plan.courts,
		sittingOut: plan.sittingOut,
		benchedPlayerIds: tournament.pendingBenchIds,
		createdAt: Date.now()
	};

	return {
		tournament: {
			...tournament,
			roundIds: [...tournament.roundIds, round.id],
			currentRoundIndex: tournament.roundIds.length,
			pendingBenchIds: [],
			lastAction: { type: 'round', roundId: round.id }
		},
		rounds: { ...rounds, [round.id]: round }
	};
}

export function recordScore(
	state: TournamentActionsState,
	roundId: string,
	court: number,
	teamAPoints: number,
	teamBPoints: number
): TournamentActionsState {
	const round = state.rounds[roundId];
	const previousScore = round.courts[court - 1].score;

	const updatedRound: Round = {
		...round,
		courts: round.courts.map((c) =>
			c.court === court ? { ...c, score: { teamAPoints, teamBPoints } } : c
		)
	};

	return {
		tournament: { ...state.tournament, lastAction: { type: 'score', roundId, court, previousScore } },
		rounds: { ...state.rounds, [roundId]: updatedRound }
	};
}

export function undoLastAction(state: TournamentActionsState): TournamentActionsState {
	const { lastAction } = state.tournament;
	if (!lastAction) return state;

	if (lastAction.type === 'score') {
		const round = state.rounds[lastAction.roundId];
		const updatedRound: Round = {
			...round,
			courts: round.courts.map((c) =>
				c.court === lastAction.court ? { ...c, score: lastAction.previousScore } : c
			)
		};
		const { lastAction: _drop, ...tournamentRest } = state.tournament;
		return {
			tournament: tournamentRest as Tournament,
			rounds: { ...state.rounds, [lastAction.roundId]: updatedRound }
		};
	}

	const round = state.rounds[lastAction.roundId];
	const { [lastAction.roundId]: _removed, ...remainingRounds } = state.rounds;
	const { lastAction: _drop, ...tournamentRest } = state.tournament;
	return {
		tournament: {
			...tournamentRest,
			roundIds: state.tournament.roundIds.filter((id) => id !== lastAction.roundId),
			currentRoundIndex: state.tournament.currentRoundIndex - 1,
			pendingBenchIds: round.benchedPlayerIds
		} as Tournament,
		rounds: remainingRounds
	};
}

export function editRoundAssignment(
	state: TournamentActionsState,
	roundId: string,
	court: number,
	teamA: [string, string],
	teamB: [string, string]
): TournamentActionsState {
	const round = state.rounds[roundId];
	const isLocked = round.courts.some((c) => c.score);
	if (isLocked) return state;

	const updatedRound: Round = {
		...round,
		courts: round.courts.map((c) => (c.court === court ? { ...c, teamA, teamB } : c))
	};

	return { ...state, rounds: { ...state.rounds, [roundId]: updatedRound } };
}

export function goToRound(tournament: Tournament, index: number): Tournament {
	const clamped = Math.max(0, Math.min(index, tournament.roundIds.length - 1));
	return { ...tournament, currentRoundIndex: clamped };
}
