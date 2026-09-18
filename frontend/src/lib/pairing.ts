import type { CourtMatch, PlayerStanding, RoundPlan } from './types';

function shuffle<T>(items: T[], random: () => number): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function generateRound(
	standings: PlayerStanding[],
	courtCount: number,
	random: () => number = Math.random
): RoundPlan {
	const eligible = shuffle(
		standings.filter((p) => !p.benched),
		random
	);
	const playableCourts = Math.min(courtCount, Math.floor(eligible.length / 4));
	const needed = playableCourts * 4;

	const byRest = [...eligible].sort((a, b) => {
		if (b.roundsSincePlayed !== a.roundsSincePlayed) {
			return b.roundsSincePlayed - a.roundsSincePlayed;
		}
		return a.gamesPlayed - b.gamesPlayed;
	});

	const selected = byRest.slice(0, needed);
	const selectedIds = new Set(selected.map((p) => p.id));
	const sittingOut = standings.filter((p) => !selectedIds.has(p.id)).map((p) => p.id);

	const byStanding = [...selected].sort((a, b) => b.totalPoints - a.totalPoints);

	const courts: CourtMatch[] = [];
	for (let i = 0; i + 4 <= byStanding.length; i += 4) {
		const [first, second, third, fourth] = byStanding.slice(i, i + 4);
		courts.push({
			court: courts.length + 1,
			teamA: [first.id, fourth.id],
			teamB: [second.id, third.id]
		});
	}

	return { courts, sittingOut };
}
