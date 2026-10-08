import { computePartnerCounts, generateFinalRoundPlan, generateRound } from './pairing';
import {
	computeOpponentCounts,
	generateTeamFinalRoundPlan,
	generateTeamRound
} from './team-pairing';
import { makeId } from './id';
import { computeStandings, computeTeamStandings } from './standings';
import { playableTeams, validateTeams } from './teams';
import type {
	PairingStyle,
	Round,
	RoundPlan,
	Standing,
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
		teams: [],
		roundIds: [],
		currentRoundIndex: -1,
		pendingBenchIds: [],
		settings: {
			darkMode: false,
			pairingFormat: 'mexicano',
			scoringMode: 'firstTo',
			pairingStyle: 'standard',
			entryMode: 'individual',
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
	const existing = tournament.courtLabels?.[court] ?? {};
	const updated = { ...existing, [side]: trimmed || undefined };

	return {
		...tournament,
		courtLabels: { ...tournament.courtLabels, [court]: updated }
	};
}

/** `id` is supplied when re-adding someone from the saved device roster, so their id stays stable
 *  across sessions. Because removePlayer is a soft delete, an id that is already present is
 *  reactivated rather than appended - otherwise the same person would end up with two Player records. */
export function addPlayer(
	tournament: Tournament,
	name: string,
	startingPoints = 0,
	id: string = makeId()
): Tournament {
	if (tournament.players.some((p) => p.id === id)) {
		return {
			...tournament,
			players: tournament.players.map((p) =>
				p.id === id ? { ...p, name, active: true, startingPoints } : p
			)
		};
	}
	return {
		...tournament,
		players: [...tournament.players, { id, name, active: true, startingPoints }]
	};
}

export function removePlayer(tournament: Tournament, playerId: string): Tournament {
	// Any team they were on is disbanded too, otherwise it would linger as a team that
	// can't field two players. Their partner falls back to unassigned, ready to re-pair.
	const orphanedTeamIds = new Set(
		tournament.teams
			.filter((team) => team.active && team.playerIds.includes(playerId))
			.map((team) => team.id)
	);

	return {
		...tournament,
		players: tournament.players.map((p) => (p.id === playerId ? { ...p, active: false } : p)),
		teams: tournament.teams.map((team) =>
			orphanedTeamIds.has(team.id) ? { ...team, active: false } : team
		),
		pendingBenchIds: tournament.pendingBenchIds.filter(
			(id) => id !== playerId && !orphanedTeamIds.has(id)
		)
	};
}

/** Pairs two players for the session. No-op if either is inactive or already on an active team. */
export function createTeam(
	tournament: Tournament,
	playerAId: string,
	playerBId: string,
	options: { name?: string; startingPoints?: number } = {}
): Tournament {
	if (playerAId === playerBId) return tournament;

	const isActivePlayer = (id: string) =>
		tournament.players.some((p) => p.id === id && p.active);
	if (!isActivePlayer(playerAId) || !isActivePlayer(playerBId)) return tournament;

	const alreadyPaired = tournament.teams.some(
		(team) =>
			team.active &&
			(team.playerIds.includes(playerAId) || team.playerIds.includes(playerBId))
	);
	if (alreadyPaired) return tournament;

	return {
		...tournament,
		teams: [
			...tournament.teams,
			{
				id: makeId(),
				playerIds: [playerAId, playerBId],
				name: options.name,
				active: true,
				startingPoints: options.startingPoints ?? 0
			}
		]
	};
}

/** Soft delete, mirroring removePlayer, so the team's completed rounds keep their attribution. */
export function disbandTeam(tournament: Tournament, teamId: string): Tournament {
	return {
		...tournament,
		teams: tournament.teams.map((team) =>
			team.id === teamId ? { ...team, active: false } : team
		),
		pendingBenchIds: tournament.pendingBenchIds.filter((id) => id !== teamId)
	};
}

export function renameTeam(tournament: Tournament, teamId: string, name: string): Tournament {
	const trimmed = name.trim();
	return {
		...tournament,
		teams: tournament.teams.map((team) =>
			team.id === teamId ? { ...team, name: trimmed || undefined } : team
		)
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
function activeStandings(state: TournamentActionsState): Standing[] {
	const { tournament, rounds } = state;
	const roundHistory = tournament.roundIds.map((id) => rounds[id]);
	const activePlayers = tournament.players.filter((p) => p.active);
	return computeStandings(activePlayers, roundHistory).map((s) => ({
		...s,
		benched: tournament.pendingBenchIds.includes(s.id)
	}));
}

/** The teams-mode counterpart. Filters to playable teams, so a team whose member was removed
 *  can never be scheduled. In this mode pendingBenchIds holds team ids. */
function activeTeamStandings(state: TournamentActionsState): Standing[] {
	const { tournament, rounds } = state;
	const roundHistory = tournament.roundIds.map((id) => rounds[id]);
	const teams = playableTeams(tournament.players, tournament.teams);
	return computeTeamStandings(teams, roundHistory).map((s) => ({
		...s,
		benched: tournament.pendingBenchIds.includes(s.id)
	}));
}

function isTeamMode(tournament: Tournament): boolean {
	return tournament.settings.entryMode === 'teams';
}

/** Teams mode can't schedule anything while a player is unpaired - the "warn and block" rule,
 *  enforced here so it holds however generation is triggered. */
export function canGenerateRound(tournament: Tournament): boolean {
	if (!isTeamMode(tournament)) return true;
	return validateTeams(tournament.players, tournament.teams).ok;
}

/** Appends a new Round built from a RoundPlan, advances the tournament, and clears pending benches. Shared by every round-generating action so undoLastAction generalizes across all of them. */
function appendRound(state: TournamentActionsState, plan: RoundPlan, isFinal = false): TournamentActionsState {
	const { tournament, rounds } = state;
	const round: Round = {
		id: makeId(),
		isFinal,
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
	if (hasFinalRound(state)) return state;
	const { tournament, rounds } = state;
	const roundHistory = tournament.roundIds.map((id) => rounds[id]);

	if (isTeamMode(tournament)) {
		if (!canGenerateRound(tournament)) return state;
		const plan = generateTeamRound(
			activeTeamStandings(state),
			tournament.teams,
			tournament.courtCount,
			{
				format: tournament.settings.pairingFormat,
				opponentCounts: computeOpponentCounts(roundHistory),
				random: Math.random
			}
		);
		return appendRound(state, plan);
	}

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
	if (hasFinalRound(state)) return state;

	if (isTeamMode(state.tournament)) {
		if (!canGenerateRound(state.tournament)) return state;
		// pairingStyle is deliberately ignored: it describes splitting a ranked group of four
		// into pairs, and in teams mode the pairs are already given.
		const plan = generateTeamFinalRoundPlan(
			activeTeamStandings(state),
			state.tournament.teams,
			state.tournament.courtCount
		);
		return appendRound(state, plan, true);
	}

	const standings = activeStandings(state);
	const plan = generateFinalRoundPlan(standings, state.tournament.courtCount, pairingStyle);
	return appendRound(state, plan, true);
}

function hasFinalRound(state: TournamentActionsState): boolean {
	return state.tournament.roundIds.some((id) => state.rounds[id]?.isFinal);
}

export function recordScore(
	state: TournamentActionsState,
	roundId: string,
	court: number,
	teamAPoints: number,
	teamBPoints: number
): TournamentActionsState {
	if (hasFinalRound(state)) return state;
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
			currentRoundIndex: state.tournament.roundIds.length - 2,
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
	teamB: [string, string],
	/** Supplied in teams mode so the stored identity moves with the players, never desyncing. */
	teamIds?: { teamAId?: string; teamBId?: string }
): TournamentActionsState {
	if (hasFinalRound(state)) return state;
	const round = state.rounds[roundId];
	const isLocked = round.courts.some((c) => c.score);
	if (isLocked) return state;

	const updatedRound: Round = {
		...round,
		courts: round.courts.map((c) =>
			c.court === court ? { ...c, teamA, teamB, ...(teamIds ?? {}) } : c
		)
	};

	return { ...state, rounds: { ...state.rounds, [roundId]: updatedRound } };
}

export function goToRound(tournament: Tournament, index: number): Tournament {
	const clamped = Math.max(0, Math.min(index, tournament.roundIds.length - 1));
	return { ...tournament, currentRoundIndex: clamped };
}
