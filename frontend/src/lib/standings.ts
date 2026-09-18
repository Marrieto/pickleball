import type { Player, PlayerStanding, Round } from './types';

function playedIn(court: Round['courts'][number], playerId: string): boolean {
	return court.teamA.includes(playerId) || court.teamB.includes(playerId);
}

function roundIncludes(round: Round, playerId: string): boolean {
	return round.courts.some((court) => playedIn(court, playerId));
}

export function computeStandings(players: Player[], rounds: Round[]): PlayerStanding[] {
	return players.map((player) => {
		let gamesPlayed = 0;
		let totalPoints = 0;
		let wins = 0;
		let timesSatOut = 0;
		let roundsSincePlayed = rounds.length;

		for (let i = rounds.length - 1; i >= 0; i--) {
			const round = rounds[i];
			for (const court of round.courts) {
				if (!playedIn(court, player.id)) continue;
				gamesPlayed++;
				if (court.score) {
					const onTeamA = court.teamA.includes(player.id);
					const ownPoints = onTeamA ? court.score.teamAPoints : court.score.teamBPoints;
					const otherPoints = onTeamA ? court.score.teamBPoints : court.score.teamAPoints;
					totalPoints += ownPoints;
					if (ownPoints > otherPoints) wins++;
				}
			}
			if (round.sittingOut.includes(player.id)) timesSatOut++;
			if (roundsSincePlayed === rounds.length && roundIncludes(round, player.id)) {
				roundsSincePlayed = rounds.length - 1 - i;
			}
		}

		return {
			id: player.id,
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
