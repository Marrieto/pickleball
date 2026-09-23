export interface PlayerStanding {
	id: string;
	gamesPlayed: number;
	totalPoints: number;
	wins: number;
	/** Rounds elapsed since this player last played (0 = played last round). */
	roundsSincePlayed: number;
	/** Total rounds sat out across the whole tournament so far (fairness indicator). */
	timesSatOut: number;
	/** Points per game played - lets players with fewer games (due to sitting out) be compared fairly. */
	adjustedScore: number;
	/** Manually sat out for the round being generated; still eligible in future rounds. */
	benched: boolean;
}

export interface CourtMatch {
	court: number;
	teamA: [string, string];
	teamB: [string, string];
	score?: MatchScore;
}

export interface MatchScore {
	teamAPoints: number;
	teamBPoints: number;
}

export interface RoundPlan {
	courts: CourtMatch[];
	sittingOut: string[];
}

export interface Player {
	id: string;
	name: string;
	active: boolean;
	/** One-time starting point offset, set when the player is added (e.g. to match the lowest current standing). Never recalculated. */
	startingPoints: number;
}

export interface Round {
	id: string;
	roundNumber: number;
	courts: CourtMatch[];
	sittingOut: string[];
	benchedPlayerIds: string[];
	createdAt: number;
}

export type PairingFormat = 'americano' | 'mexicano';
export type ScoringMode = 'firstTo' | 'bestOf';
export type FinalRoundPairingStyle = 'standard' | 'alternate';

export interface TournamentSettings {
	darkMode: boolean;
	/** Americano = least-recently-partnered rotation, ignores standings. Mexicano = rank-based seeding from current standings (today's default). */
	pairingFormat: PairingFormat;
	/** firstTo = open-ended race to targetScore. bestOf = fixed point pool of targetScore, split between the two teams. */
	scoringMode: ScoringMode;
	/** Default partner-split style offered when generating a final round; re-selectable per generation. */
	finalRoundPairingStyle: FinalRoundPairingStyle;
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
	roundIds: string[];
	currentRoundIndex: number;
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
