import { computePartnerCounts, generateFinalRoundPlan, generateRound } from './pairing';
import { makeId } from './id';
import { computeStandings } from './standings';
import type {
	PairingStyle,
	PlayerStanding,
	Round,
	RoundPlan,
	Tournament,
	TournamentActionsState,
	TournamentSettings
} from './types';

export function createTournament(
	name: string,
	courtCount: number,
	targetScore: number,
	settings: Partial<TournamentSettings> = {}
): Tournament {
	return {
		id: makeId(),
		name,
		courtCount,
		targetScore,
		players: [],
		roundIds: [],
		currentRoundIndex: -1,
		pendingBenchIds: [],
		settings: {
			darkMode: false,
			pairingFormat: 'mexicano',
			scoringMode: 'firstTo',
			pairingStyle: 'standard',
			...settings
		},
		courtLabels: {},
		createdAt: Date.now()
	};
}

export function setCourtLabel(
	tournament: Tournament,
	court: number,
	side: 'teamA' | 'teamB',
	label: string
): Tournament {
	const trimmed = label.trim();
	const existing = tournament.courtLabels[court] ?? {};
	const updated = { ...existing, [side]: trimmed || undefined };

	return {
		...tournament,
		courtLabels: { ...tournament.courtLabels, [court]: updated }
	};
}

export function addPlayer(tournament: Tournament, name: string, startingPoints = 0): Tournament {
	return {
		...tournament,
		players: [...tournament.players, { id: makeId(), name, active: true, startingPoints }]
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

/** Standings for the tournament's active players, with pending-bench players marked. Shared by every round-generating action. */
function activeStandings(state: TournamentActionsState): PlayerStanding[] {
	const { tournament, rounds } = state;
	const roundHistory = tournament.roundIds.map((id) => rounds[id]);
	const activePlayers = tournament.players.filter((p) => p.active);
	return computeStandings(activePlayers, roundHistory).map((s) => ({
		...s,
		benched: tournament.pendingBenchIds.includes(s.id)
	}));
}

/** Appends a new Round built from a RoundPlan, advances the tournament, and clears pending benches. Shared by every round-generating action so undoLastAction generalizes across all of them. */
function appendRound(state: TournamentActionsState, plan: RoundPlan): TournamentActionsState {
	const { tournament, rounds } = state;
	const round: Round = {
		id: makeId(),
		roundNumber: tournament.roundIds.length + 1,
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

export function generateNextRound(state: TournamentActionsState): TournamentActionsState {
	const { tournament, rounds } = state;
	const roundHistory = tournament.roundIds.map((id) => rounds[id]);
	const standings = activeStandings(state);
	const partnerCounts = computePartnerCounts(roundHistory);
	const plan = generateRound(standings, tournament.courtCount, {
		format: tournament.settings.pairingFormat,
		partnerCounts,
		pairingStyle: tournament.settings.pairingStyle,
		random: Math.random
	});
	return appendRound(state, plan);
}

export function generateFinalRound(
	state: TournamentActionsState,
	pairingStyle: PairingStyle
): TournamentActionsState {
	const standings = activeStandings(state);
	const plan = generateFinalRoundPlan(standings, state.tournament.courtCount, pairingStyle);
	return appendRound(state, plan);
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
