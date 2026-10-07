import type { CourtMatch, Player, Round, Standing, Team } from './types';

/** Which side of a court a scoring unit is on, or null if it isn't in this match. */
type SideOf = (court: CourtMatch, unitId: string) => 'A' | 'B' | null;

const playerSide: SideOf = (court, id) =>
	court.teamA.includes(id) ? 'A' : court.teamB.includes(id) ? 'B' : null;

/** Teams are matched on the stored ids only. A court without them is from an individual-mode
 *  round and contributes nothing - never fall back to matching the player tuple, which
 *  editRoundAssignment is free to rewrite. */
const teamSide: SideOf = (court, id) =>
	court.teamAId === id ? 'A' : court.teamBId === id ? 'B' : null;

/** Shared accumulation for both scoring units, so the two never drift on
 *  roundsSincePlayed / timesSatOut semantics. */
function accumulate(
	units: { id: string; startingPoints: number }[],
	rounds: Round[],
	sideOf: SideOf
): Standing[] {
	return units.map((unit) => {
		let gamesPlayed = 0;
		let totalPoints = unit.startingPoints ?? 0;
		let wins = 0;
		let timesSatOut = 0;
		let roundsSincePlayed = rounds.length;

		for (let i = rounds.length - 1; i >= 0; i--) {
			const round = rounds[i];
			let playedThisRound = false;
			for (const court of round.courts) {
				const side = sideOf(court, unit.id);
				if (!side) continue;
				playedThisRound = true;
				gamesPlayed++;
				if (court.score) {
					const ownPoints = side === 'A' ? court.score.teamAPoints : court.score.teamBPoints;
					const otherPoints = side === 'A' ? court.score.teamBPoints : court.score.teamAPoints;
					totalPoints += ownPoints;
					if (ownPoints > otherPoints) wins++;
				}
			}
			if (round.sittingOut.includes(unit.id)) timesSatOut++;
			if (roundsSincePlayed === rounds.length && playedThisRound) {
				roundsSincePlayed = rounds.length - 1 - i;
			}
		}

		return {
			id: unit.id,
			gamesPlayed,
			totalPoints,
			wins,
			roundsSincePlayed,
			timesSatOut,
			adjustedScore: gamesPlayed > 0 ? totalPoints / gamesPlayed : 0,
			benched: false
		};
	});
}

export function computeStandings(players: Player[], rounds: Round[]): Standing[] {
	return accumulate(players, rounds, playerSide);
}

/** Teams-mode standings. Same shape, but `id` holds a team id - which is what lets
 *  rankStandings, the rest-priority selector and the leaderboard generalize unchanged. */
export function computeTeamStandings(teams: Team[], rounds: Round[]): Standing[] {
	return accumulate(teams, rounds, teamSide);
}

/** Ranks by total points, breaking ties with the higher adjusted (per-game) score. */
export function rankStandings(standings: Standing[]): Standing[] {
	return [...standings].sort((a, b) => {
		if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
		return b.adjustedScore - a.adjustedScore;
	});
}
