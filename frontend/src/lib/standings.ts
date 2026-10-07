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
		const handicap = unit.startingPoints ?? 0;
		let gamesPlayed = 0;
		let earnedPoints = 0;
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
					earnedPoints += ownPoints;
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
			totalPoints: handicap + earnedPoints,
			wins,
			roundsSincePlayed,
			timesSatOut,
			// Only points won on court are averaged. The handicap exists to make a late joiner's
			// TOTAL comparable, so folding it in here would hand them a huge average off one game.
			adjustedScore: gamesPlayed > 0 ? earnedPoints / gamesPlayed : 0,
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

/** Ranks by adjusted (per-game) score - the figure that decides the night. Ties go to whoever
 *  played more rounds, then to total points. Exact ties are common rather than freak events:
 *  in firstTo scoring the winner always takes exactly the target, so a player who wins every
 *  game lands on a round number. Games played is deliberately ahead of total points here, so a
 *  late joiner's handicap can never buy them a tiebreak.
 *  Used for the leaderboard, final-round seeding and rank-based matchmaking alike, so "who's
 *  top" means one thing everywhere. */
export function rankStandings(standings: Standing[]): Standing[] {
	return [...standings].sort((a, b) => {
		if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
		if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
		return b.totalPoints - a.totalPoints;
	});
}
