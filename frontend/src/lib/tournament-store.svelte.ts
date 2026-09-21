import { PersistedState } from 'runed';
import {
	addPlayer as addPlayerAction,
	createTournament as createTournamentAction,
	editRoundAssignment as editRoundAssignmentAction,
	generateNextRound as generateNextRoundAction,
	goToRound as goToRoundAction,
	recordScore as recordScoreAction,
	removePlayer as removePlayerAction,
	setCourtLabel as setCourtLabelAction,
	togglePendingBench as togglePendingBenchAction,
	undoLastAction as undoLastActionAction
} from './tournament-actions';
import { computeStandings, rankStandings } from './standings';
import type { PlayerStanding, Round, Tournament, TournamentActionsState } from './types';

const TOURNAMENT_KEY = 'americano:tournament';
const roundKey = (id: string) => `americano:round:${id}`;

class TournamentStore {
	private tournamentState = new PersistedState<Tournament | null>(TOURNAMENT_KEY, null);
	private roundStates = new Map<string, PersistedState<Round>>();

	get tournament(): Tournament | null {
		return this.tournamentState.current;
	}

	get currentRound(): Round | undefined {
		const t = this.tournament;
		if (!t || t.currentRoundIndex < 0) return undefined;
		return this.round(t.roundIds[t.currentRoundIndex]);
	}

	get standings(): PlayerStanding[] {
		const t = this.tournament;
		if (!t) return [];
		const active = t.players.filter((p) => p.active);
		const history = t.roundIds.map((id) => this.round(id)!);
		return rankStandings(computeStandings(active, history));
	}

	round(id: string): Round | undefined {
		return id ? this.roundState(id).current : undefined;
	}

	private roundState(id: string): PersistedState<Round> {
		let state = this.roundStates.get(id);
		if (!state) {
			state = new PersistedState<Round>(roundKey(id), {
				id,
				roundNumber: 0,
				courts: [],
				sittingOut: [],
				benchedPlayerIds: [],
				createdAt: Date.now()
			});
			this.roundStates.set(id, state);
		}
		return state;
	}

	private collectRounds(t: Tournament): Record<string, Round> {
		const rounds: Record<string, Round> = {};
		for (const id of t.roundIds) rounds[id] = this.roundState(id).current;
		return rounds;
	}

	private apply(result: TournamentActionsState, previousRoundIds: string[]) {
		this.tournamentState.current = result.tournament;
		for (const id of Object.keys(result.rounds)) {
			this.roundState(id).current = result.rounds[id];
		}
		for (const id of previousRoundIds) {
			if (!(id in result.rounds)) {
				this.roundStates.get(id)?.disconnect();
				this.roundStates.delete(id);
			}
		}
	}

	startTournament(name: string, courtCount: number, targetScore: number) {
		this.tournamentState.current = createTournamentAction(name, courtCount, targetScore);
	}

	endTournament() {
		for (const state of this.roundStates.values()) state.disconnect();
		this.roundStates.clear();
		this.tournamentState.current = null;
	}

	addPlayer(name: string) {
		if (!this.tournament) return;
		this.tournamentState.current = addPlayerAction(this.tournament, name);
	}

	removePlayer(id: string) {
		if (!this.tournament) return;
		this.tournamentState.current = removePlayerAction(this.tournament, id);
	}

	togglePendingBench(id: string) {
		if (!this.tournament) return;
		this.tournamentState.current = togglePendingBenchAction(this.tournament, id);
	}

	setCourtLabel(court: number, side: 'teamA' | 'teamB', label: string) {
		if (!this.tournament) return;
		this.tournamentState.current = setCourtLabelAction(this.tournament, court, side, label);
	}

	generateNextRound() {
		const t = this.tournament;
		if (!t) return;
		const result = generateNextRoundAction({ tournament: t, rounds: this.collectRounds(t) });
		this.apply(result, t.roundIds);
	}

	recordScore(roundId: string, court: number, teamAPoints: number, teamBPoints: number) {
		const t = this.tournament;
		if (!t) return;
		const result = recordScoreAction(
			{ tournament: t, rounds: this.collectRounds(t) },
			roundId,
			court,
			teamAPoints,
			teamBPoints
		);
		this.apply(result, t.roundIds);
	}

	editRoundAssignment(
		roundId: string,
		court: number,
		teamA: [string, string],
		teamB: [string, string]
	) {
		const t = this.tournament;
		if (!t) return;
		const result = editRoundAssignmentAction(
			{ tournament: t, rounds: this.collectRounds(t) },
			roundId,
			court,
			teamA,
			teamB
		);
		this.apply(result, t.roundIds);
	}

	undo() {
		const t = this.tournament;
		if (!t) return;
		const result = undoLastActionAction({ tournament: t, rounds: this.collectRounds(t) });
		this.apply(result, t.roundIds);
	}

	goToRound(index: number) {
		if (!this.tournament) return;
		this.tournamentState.current = goToRoundAction(this.tournament, index);
	}

	toggleDarkMode() {
		if (!this.tournament) return;
		this.tournamentState.current = {
			...this.tournament,
			settings: { ...this.tournament.settings, darkMode: !this.tournament.settings.darkMode }
		};
	}
}

export const tournamentStore = new TournamentStore();
