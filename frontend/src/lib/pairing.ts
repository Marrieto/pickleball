import { rankStandings } from './standings';
import type {
	CourtMatch,
	PairingStyle,
	PairingFormat,
	PlayerStanding,
	Round,
	RoundPlan
} from './types';

export function partnerKey(a: string, b: string): string {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Derives how many times each pair of players has been teammates from round history. */
export function computePartnerCounts(rounds: Round[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const round of rounds) {
		for (const court of round.courts) {
			for (const pair of [court.teamA, court.teamB]) {
				const key = partnerKey(pair[0], pair[1]);
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
		}
	}
	return counts;
}

function shuffle<T>(items: T[], random: () => number): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/** Rest-priority selection: who plays this round vs. sits out. Shared by every pairing format. */
function selectEligiblePlayers(
	standings: PlayerStanding[],
	courtCount: number,
	random: () => number
): { selected: PlayerStanding[]; sittingOut: string[] } {
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

	return { selected, sittingOut };
}

function buildTeams(
	group: [PlayerStanding, PlayerStanding, PlayerStanding, PlayerStanding],
	style: PairingStyle,
	courtNumber: number
): CourtMatch {
	const [first, second, third, fourth] = group;
	const [teamA, teamB]: [[string, string], [string, string]] =
		style === 'alternate'
			? [
					[first.id, third.id],
					[second.id, fourth.id]
				]
			: [
					[first.id, fourth.id],
					[second.id, third.id]
				];
	return { court: courtNumber, teamA, teamB };
}

/** Mexicano: rank-sorted groups of 4, split into teams per the given style. */
function pairByRank(players: PlayerStanding[], style: PairingStyle): CourtMatch[] {
	const byStanding = [...players].sort((a, b) => b.totalPoints - a.totalPoints);

	const courts: CourtMatch[] = [];
	for (let i = 0; i + 4 <= byStanding.length; i += 4) {
		const group = byStanding.slice(i, i + 4) as [
			PlayerStanding,
			PlayerStanding,
			PlayerStanding,
			PlayerStanding
		];
		courts.push(buildTeams(group, style, courts.length + 1));
	}
	return courts;
}

/** All 3 ways to split 4 players into two pairs of 2. */
function teamSplits(
	group: [PlayerStanding, PlayerStanding, PlayerStanding, PlayerStanding]
): [PlayerStanding, PlayerStanding][][] {
	const [a, b, c, d] = group;
	return [
		[
			[a, b],
			[c, d]
		],
		[
			[a, c],
			[b, d]
		],
		[
			[a, d],
			[b, c]
		]
	];
}

function splitIntoTeams(
	group: [PlayerStanding, PlayerStanding, PlayerStanding, PlayerStanding],
	partnerCounts: Map<string, number>,
	random: () => number
): { teamA: [string, string]; teamB: [string, string] } {
	const options = shuffle(teamSplits(group), random);
	let best = options[0];
	let bestCost = Infinity;
	for (const option of options) {
		const cost = option.reduce(
			(sum, [p1, p2]) => sum + (partnerCounts.get(partnerKey(p1.id, p2.id)) ?? 0),
			0
		);
		if (cost < bestCost) {
			bestCost = cost;
			best = option;
		}
	}
	const [[a1, a2], [b1, b2]] = best;
	return { teamA: [a1.id, a2.id], teamB: [b1.id, b2.id] };
}

/** Americano: greedily forms groups of 4, then splits each into teams, minimizing repeat partnerships. Never consults score/rank. */
function pairLeastRecentlyPartnered(
	players: PlayerStanding[],
	partnerCounts: Map<string, number>,
	random: () => number
): CourtMatch[] {
	const remaining = shuffle(players, random);
	const courts: CourtMatch[] = [];

	while (remaining.length >= 4) {
		const group: PlayerStanding[] = [remaining.shift()!];
		while (group.length < 4) {
			let bestIndex = 0;
			let bestCost = Infinity;
			for (let i = 0; i < remaining.length; i++) {
				const cost = group.reduce(
					(sum, member) => sum + (partnerCounts.get(partnerKey(member.id, remaining[i].id)) ?? 0),
					0
				);
				if (cost < bestCost) {
					bestCost = cost;
					bestIndex = i;
				}
			}
			group.push(remaining.splice(bestIndex, 1)[0]);
		}
		const [first, second, third, fourth] = group;
		const { teamA, teamB } = splitIntoTeams([first, second, third, fourth], partnerCounts, random);
		courts.push({ court: courts.length + 1, teamA, teamB });
	}

	return courts;
}

export interface GenerateRoundOptions {
	/** 'mexicano' (default) = rank-based seeding from current standings. 'americano' = least-recently-partnered rotation, ignores standings. */
	format?: PairingFormat;
	/** Partner-history counts (from computePartnerCounts), consulted only when format is 'americano'. */
	partnerCounts?: Map<string, number>;
	/** How a ranked group of 4 splits into teams, consulted only when format is 'mexicano'. Default 'standard'. */
	pairingStyle?: PairingStyle;
	random?: () => number;
}

export function generateRound(
	standings: PlayerStanding[],
	courtCount: number,
	options: GenerateRoundOptions = {}
): RoundPlan {
	const {
		format = 'mexicano',
		partnerCounts = new Map(),
		pairingStyle = 'standard',
		random = Math.random
	} = options;
	const { selected, sittingOut } = selectEligiblePlayers(standings, courtCount, random);
	const courts =
		format === 'americano'
			? pairLeastRecentlyPartnered(selected, partnerCounts, random)
			: pairByRank(selected, pairingStyle);
	return { courts, sittingOut };
}

/** Final round: top courtCount*4 players by standing play; everyone else sits out entirely. */
export function generateFinalRoundPlan(
	standings: PlayerStanding[],
	courtCount: number,
	pairingStyle: PairingStyle
): RoundPlan {
	const eligible = standings.filter((p) => !p.benched);
	const ranked = rankStandings(eligible);

	const playableCourts = Math.min(courtCount, Math.floor(ranked.length / 4));
	const selected = ranked.slice(0, playableCourts * 4);
	const selectedIds = new Set(selected.map((p) => p.id));
	const sittingOut = standings.filter((p) => !selectedIds.has(p.id)).map((p) => p.id);

	const courts: CourtMatch[] = [];
	for (let i = 0; i + 4 <= selected.length; i += 4) {
		const group = selected.slice(i, i + 4) as [
			PlayerStanding,
			PlayerStanding,
			PlayerStanding,
			PlayerStanding
		];
		courts.push(buildTeams(group, pairingStyle, courts.length + 1));
	}

	return { courts, sittingOut };
}
