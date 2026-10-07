export interface PlayerStanding {
	/** Player id in individual mode, team id in teams mode. */
	id: string;
	gamesPlayed: number;
	totalPoints: number;
	wins: number;
	/** Rounds elapsed since this player last played (0 = played last round). */
	roundsSincePlayed: number;
	/** Total rounds sat out across the whole tournament so far (fairness indicator). */
	timesSatOut: number;
	/** Points won on court per game played, excluding any starting handicap. This is what decides
	 *  the standings - it lets players with fewer games (sat out, or arrived late) compare fairly. */
	adjustedScore: number;
	/** Manually sat out for the round being generated; still eligible in future rounds. */
	benched: boolean;
}

/** A standings row. Identified by player id in individual mode, team id in teams mode. */
export type Standing = PlayerStanding;

export interface CourtMatch {
	court: number;
	teamA: [string, string];
	teamB: [string, string];
	/** Set only by teams-mode generation. Authoritative team identity for standings and
	 *  opponent history - never derive this from the player tuple, which edits can rewrite. */
	teamAId?: string;
	teamBId?: string;
	score?: MatchScore;
}

export interface MatchScore {
	teamAPoints: number;
	teamBPoints: number;
}

export interface RoundPlan {
	courts: CourtMatch[];
	/** Player ids in individual mode, team ids in teams mode. */
	sittingOut: string[];
}

export interface Player {
	id: string;
	name: string;
	active: boolean;
	/** One-time starting point offset, set when the player is added (e.g. to match the lowest current standing). Never recalculated.
	 *  Ignored in teams mode, where Team.startingPoints is the only offset that counts. */
	startingPoints: number;
}

/** A fixed pair for the whole session. Distinct from CourtMatch.teamA/teamB, which stay
 *  ephemeral per-round player tuples in individual mode. */
export interface Team {
	id: string;
	/** Exactly two player ids. Order is display order and is stable across rounds. */
	playerIds: [string, string];
	/** Optional custom name; falls back to "Anna & Bo" built from member names. */
	name?: string;
	active: boolean;
	/** One-time offset for teams formed mid-session. Mirrors Player.startingPoints. */
	startingPoints: number;
}

export interface Round {
	id: string;
	isFinal?: boolean;
	roundNumber: number;
	courts: CourtMatch[];
	/** Player ids in individual mode, team ids in teams mode. */
	sittingOut: string[];
	/** Snapshot of pendingBenchIds - player ids in individual mode, team ids in teams mode. */
	benchedPlayerIds: string[];
	createdAt: number;
}

export type PairingFormat = 'americano' | 'mexicano';
export type ScoringMode = 'firstTo' | 'bestOf';
export type PairingStyle = 'standard' | 'alternate';
/** individual = partners rotate every round. teams = fixed pairs for the whole session. */
export type EntryMode = 'individual' | 'teams';

export interface TournamentSettings {
	darkMode: boolean;
	/** Americano = least-recently-partnered rotation, ignores standings. Mexicano = rank-based seeding from current standings (today's default). */
	pairingFormat: PairingFormat;
	/** firstTo = open-ended race to targetScore. bestOf = fixed point pool of targetScore, split between the two teams. */
	scoringMode: ScoringMode;
	/** How a ranked group of 4 splits into two teams: 'standard' = 1st+4th vs 2nd+3rd, 'alternate' = 1st+3rd vs 2nd+4th.
	 *  Governs Mexicano normal-round pairing and is the default offered when generating a final round (re-selectable per generation).
	 *  Meaningless in teams mode, where the pairs are given rather than split out of a group of four. */
	pairingStyle: PairingStyle;
	/** Chosen at setup and fixed once the first round exists - switching mid-session would make
	 *  every prior round invisible to the other mode's standings model. */
	entryMode: EntryMode;
}

/** A physical side of a numbered court (e.g. "glasvägg"/"betongvägg") - stable across rounds, independent of which team plays there. */
export interface CourtSideLabels {
	teamA?: string;
	teamB?: string;
}

export type LastAction =
	| { type: 'score'; roundId: string; court: number; previousScore: MatchScore | undefined }
	| { type: 'round'; roundId: string };

export interface Tournament {
	id: string;
	name: string;
	courtCount: number;
	targetScore: number;
	players: Player[];
	/** Empty in individual mode. Always read through TournamentStore, which defaults legacy records to []. */
	teams: Team[];
	roundIds: string[];
	currentRoundIndex: number;
	/** Player ids in individual mode, team ids in teams mode. */
	pendingBenchIds: string[];
	settings: TournamentSettings;
	courtLabels: Record<number, CourtSideLabels>;
	lastAction?: LastAction;
	createdAt: number;
}

export interface TournamentActionsState {
	tournament: Tournament;
	rounds: Record<string, Round>;
}
