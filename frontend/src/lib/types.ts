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
}

export interface Round {
	id: string;
	roundNumber: number;
	courts: CourtMatch[];
	sittingOut: string[];
	benchedPlayerIds: string[];
	createdAt: number;
}

export interface TournamentSettings {
	darkMode: boolean;
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
	lastAction?: LastAction;
	createdAt: number;
}

export interface TournamentActionsState {
	tournament: Tournament;
	rounds: Record<string, Round>;
}
