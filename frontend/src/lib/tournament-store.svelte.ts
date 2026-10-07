import { PersistedState } from 'runed';
import {
	addPlayer as addPlayerAction,
	canGenerateRound as canGenerateRoundAction,
	createTeam as createTeamAction,
	createTournament as createTournamentAction,
	disbandTeam as disbandTeamAction,
	editRoundAssignment as editRoundAssignmentAction,
	generateFinalRound as generateFinalRoundAction,
	generateNextRound as generateNextRoundAction,
	goToRound as goToRoundAction,
	recordScore as recordScoreAction,
	removePlayer as removePlayerAction,
	renameTeam as renameTeamAction,
	setCourtLabel as setCourtLabelAction,
	togglePendingBench as togglePendingBenchAction,
	undoLastAction as undoLastActionAction
} from './tournament-actions';
import { makeId } from './id';
import { computeStandings, computeTeamStandings, rankStandings } from './standings';
import { playableTeams, teamName, unassignedActivePlayers, validateTeams } from './teams';
import type {
	PairingStyle,
	CourtSideLabels,
	Player,
	PlayerStanding,
	Round,
	Team,
	Tournament,
	TournamentActionsState,
	TournamentSettings
} from './types';
import type { TeamValidation } from './teams';

const DEFAULT_SETTINGS: TournamentSettings = {
	darkMode: false,
	pairingFormat: 'mexicano',
	scoringMode: 'firstTo',
	pairingStyle: 'standard',
	entryMode: 'individual'
};

const TOURNAMENT_KEY = 'americano:tournament';
const roundKey = (id: string) => `americano:round:${id}`;

/** A name remembered on this device, independent of any one tournament. */
interface RosterEntry {
	id: string;
	name: string;
}

interface DevicePreferences {
	darkMode: boolean;
	courtLabels: Record<number, CourtSideLabels>;
	/** Everyone ever added on this device. Only forgetRosterPlayer removes from here. */
	roster: RosterEntry[];
	/** Roster ids active in the most recent session - what a new tournament auto-fills from.
	 *  Kept separate from `roster` because a club's roster outgrows any single night. */
	lastLineup: string[];
}

export class TournamentStore {
	private tournamentState = new PersistedState<Tournament | null>(TOURNAMENT_KEY, null);
	private preferences = new PersistedState<DevicePreferences>('americano:preferences', {
		darkMode: this.tournamentState.current?.settings?.darkMode ?? false,
		courtLabels: this.tournamentState.current?.courtLabels ?? {},
		roster: [],
		lastLineup: []
	});
	private roundStates = new Map<string, PersistedState<Round>>();

	get darkMode(): boolean {
		return this.preferences.current.darkMode;
	}

	/** Device preferences with defaults for fields added after a user's preferences were first written. */
	private get prefs(): DevicePreferences {
		const p = this.preferences.current;
		return { ...p, roster: p.roster ?? [], lastLineup: p.lastLineup ?? [] };
	}

	/** Names remembered on this device that aren't in the current tournament - offered for one-tap re-adding. */
	get availableRoster(): RosterEntry[] {
		const present = new Set(
			(this.tournament?.players ?? []).filter((p) => p.active).map((p) => p.id)
		);
		return this.prefs.roster.filter((entry) => !present.has(entry.id));
	}

	get tournament(): Tournament | null {
		const t = this.tournamentState.current;
		if (!t) return t;
		// Defensive defaults for tournaments persisted before these fields existed.
		return { ...t, teams: t.teams ?? [], settings: { ...DEFAULT_SETTINGS, ...t.settings } };
	}

	get currentRound(): Round | undefined {
		const t = this.tournament;
		if (!t || t.currentRoundIndex < 0) return undefined;
		return this.round(t.roundIds[t.currentRoundIndex]);
	}

	get standings(): PlayerStanding[] {
		const t = this.tournament;
		if (!t) return [];
		const history = t.roundIds.map((id) => this.round(id)!).filter((round) => !round.isFinal);
		const latestRound = this.round(t.roundIds.at(-1) ?? '');
		const base = this.isTeamMode
			? computeTeamStandings(playableTeams(t.players, t.teams), history)
			: computeStandings(
					t.players.filter((p) => p.active),
					history
				);
		return rankStandings(base.map((standing) => ({
			...standing,
			timesSatOut: standing.timesSatOut - (
				latestRound && !latestRound.isFinal && latestRound.sittingOut.includes(standing.id) ? 1 : 0
			)
		})));
	}

	get isTeamMode(): boolean {
		return this.tournament?.settings.entryMode === 'teams';
	}

	/** Teams that can actually field two players. */
	get teams(): Team[] {
		const t = this.tournament;
		return t ? playableTeams(t.players, t.teams) : [];
	}

	get teamValidation(): TeamValidation {
		const t = this.tournament;
		return t
			? validateTeams(t.players, t.teams)
			: { ok: false, unassignedPlayerIds: [], duplicatePlayerIds: [], brokenTeamIds: [], playableTeamCount: 0 };
	}

	get unassignedPlayers(): Player[] {
		const t = this.tournament;
		return t ? unassignedActivePlayers(t.players, t.teams) : [];
	}

	/** Whether a round can be generated right now - false while teams mode has an unpaired player. */
	get canGenerateRound(): boolean {
		const t = this.tournament;
		return t ? canGenerateRoundAction(t) : false;
	}

	/** Resolves a player id or a team id to a label, so views that render whichever the current
	 *  mode keys on (sitting-out lists, the leaderboard, court chips) don't each need the branch. */
	displayName(id: string): string {
		const t = this.tournament;
		if (!t) return '?';
		const team = t.teams.find((candidate) => candidate.id === id);
		if (team) return teamName(team, t.players);
		return t.players.find((p) => p.id === id)?.name ?? '?';
	}

	get isFinalized(): boolean {
		return this.tournament?.roundIds.some((id) => this.round(id)?.isFinal) ?? false;
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

	startTournament(
		name: string,
		courtCount: number,
		targetScore: number,
		settings?: Partial<TournamentSettings>
	) {
		const { roster, lastLineup } = this.prefs;
		// Fall back to the whole roster the first time, before any lineup has been recorded.
		const lineup = lastLineup.length > 0 ? lastLineup : roster.map((entry) => entry.id);
		const byId = new Map(roster.map((entry) => [entry.id, entry]));

		this.tournamentState.current = {
			...createTournamentAction(name, courtCount, targetScore, { ...settings, darkMode: this.darkMode }),
			courtLabels: Object.fromEntries(
				Object.entries(this.prefs.courtLabels).map(([court, labels]) => [court, { ...labels }])
			),
			// Roster ids carry over as player ids, so a person keeps one identity across sessions.
			players: lineup
				.map((id) => byId.get(id))
				.filter((entry) => entry !== undefined)
				.map((entry) => ({ id: entry.id, name: entry.name, active: true, startingPoints: 0 }))
		};
	}

	endTournament() {
		for (const state of this.roundStates.values()) state.disconnect();
		this.roundStates.clear();
		this.tournamentState.current = null;
	}

	addPlayer(name: string, startingPoints = 0, id: string = makeId()) {
		if (!this.tournament || this.isFinalized) return;
		this.tournamentState.current = addPlayerAction(this.tournament, name, startingPoints, id);
		this.rememberPlayer(id, name);
	}

	removePlayer(id: string) {
		if (!this.tournament || this.isFinalized) return;
		this.tournamentState.current = removePlayerAction(this.tournament, id);
		// Absent tonight is not the same as gone for good: drop from the lineup, keep in the roster.
		const prefs = this.prefs;
		this.preferences.current = {
			...prefs,
			lastLineup: prefs.lastLineup.filter((entry) => entry !== id)
		};
	}

	/** Drops a name from the device for good - the only way a player leaves the saved roster. */
	forgetRosterPlayer(id: string) {
		const prefs = this.prefs;
		this.preferences.current = {
			...prefs,
			roster: prefs.roster.filter((entry) => entry.id !== id),
			lastLineup: prefs.lastLineup.filter((entry) => entry !== id)
		};
	}

	createTeam(playerAId: string, playerBId: string, options?: { name?: string; startingPoints?: number }) {
		if (!this.tournament || this.isFinalized) return;
		this.tournamentState.current = createTeamAction(this.tournament, playerAId, playerBId, options);
	}

	disbandTeam(teamId: string) {
		if (!this.tournament || this.isFinalized) return;
		this.tournamentState.current = disbandTeamAction(this.tournament, teamId);
	}

	renameTeam(teamId: string, name: string) {
		if (!this.tournament || this.isFinalized) return;
		this.tournamentState.current = renameTeamAction(this.tournament, teamId, name);
	}

	/** Mirrors a player into device preferences, the same way setCourtLabel mirrors court labels. */
	private rememberPlayer(id: string, name: string) {
		const prefs = this.prefs;
		const roster = prefs.roster.some((entry) => entry.id === id)
			? prefs.roster.map((entry) => (entry.id === id ? { ...entry, name } : entry))
			: [...prefs.roster, { id, name }];
		this.preferences.current = {
			...prefs,
			roster,
			lastLineup: prefs.lastLineup.includes(id) ? prefs.lastLineup : [...prefs.lastLineup, id]
		};
	}

	togglePendingBench(id: string) {
		if (!this.tournament || this.isFinalized) return;
		this.tournamentState.current = togglePendingBenchAction(this.tournament, id);
	}

	setCourtLabel(court: number, side: 'teamA' | 'teamB', label: string) {
		if (!this.tournament || this.isFinalized) return;
		const updated = setCourtLabelAction(this.tournament, court, side, label);
		this.tournamentState.current = updated;
		const preferences = this.prefs;
		this.preferences.current = {
			...preferences,
			courtLabels: {
				...preferences.courtLabels,
				[court]: { ...preferences.courtLabels[court], [side]: updated.courtLabels[court][side] }
			}
		};
	}

	generateNextRound() {
		const t = this.tournament;
		if (!t) return;
		const result = generateNextRoundAction({ tournament: t, rounds: this.collectRounds(t) });
		this.apply(result, t.roundIds);
	}

	generateFinalRound(pairingStyle: PairingStyle) {
		const t = this.tournament;
		if (!t) return;
		const result = generateFinalRoundAction({ tournament: t, rounds: this.collectRounds(t) }, pairingStyle);
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
		teamB: [string, string],
		teamIds?: { teamAId?: string; teamBId?: string }
	) {
		const t = this.tournament;
		if (!t) return;
		const result = editRoundAssignmentAction(
			{ tournament: t, rounds: this.collectRounds(t) },
			roundId,
			court,
			teamA,
			teamB,
			teamIds
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
		const darkMode = !this.darkMode;
		this.preferences.current = { ...this.preferences.current, darkMode };
		if (!this.tournament) return;
		this.tournamentState.current = {
			...this.tournament,
			settings: { ...this.tournament.settings, darkMode }
		};
	}
}

export const tournamentStore = new TournamentStore();
