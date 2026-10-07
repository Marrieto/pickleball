import { rankStandings } from './standings';
import { selectEligibleUnits, shuffle } from './pairing';
import type { CourtMatch, PairingFormat, Round, RoundPlan, Standing, Team } from './types';

/** Order-independent key for a matchup, mirroring partnerKey. */
export function opponentKey(a: string, b: string): string {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** How many times each pair of teams has faced each other. Courts without stored team ids are
 *  individual-mode rounds and are skipped - the player tuple is not a reliable team identity. */
export function computeOpponentCounts(rounds: Round[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const round of rounds) {
		for (const court of round.courts) {
			if (!court.teamAId || !court.teamBId) continue;
			const key = opponentKey(court.teamAId, court.teamBId);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return counts;
}

/** Above this many teams the exhaustive search isn't worth it (and the bitmask gets unwieldy).
 *  16 teams is 8 courts of pairs - well past any realistic club night. */
const EXACT_MATCHING_LIMIT = 16;

/** Minimum-cost perfect matching over an even-sized list, memoized on the remaining-set bitmask.
 *  Exact rather than greedy on purpose: greedy can strand the last two units in a repeat matchup
 *  when a repeat-free pairing of the whole field existed, which is precisely what the rotation
 *  format promises not to do. */
function matchPairsExact<T>(units: T[], cost: (a: T, b: T) => number): [T, T][] {
	const n = units.length;
	const memo = new Map<number, { cost: number; pairs: [number, number][] }>();

	function solve(mask: number): { cost: number; pairs: [number, number][] } {
		if (mask === 0) return { cost: 0, pairs: [] };
		const cached = memo.get(mask);
		if (cached) return cached;

		// Always pair the lowest remaining index, so each matching is enumerated exactly once.
		let i = 0;
		while (((mask >> i) & 1) === 0) i++;

		let best: { cost: number; pairs: [number, number][] } | null = null;
		for (let j = i + 1; j < n; j++) {
			if (((mask >> j) & 1) === 0) continue;
			const rest = solve(mask & ~(1 << i) & ~(1 << j));
			const total = cost(units[i], units[j]) + rest.cost;
			if (best === null || total < best.cost) {
				best = { cost: total, pairs: [[i, j], ...rest.pairs] };
			}
		}

		const result = best ?? { cost: 0, pairs: [] };
		memo.set(mask, result);
		return result;
	}

	return solve((1 << n) - 1).pairs.map(([i, j]) => [units[i], units[j]] as [T, T]);
}

/** Greedy fallback for fields too large to search exhaustively. */
function matchPairsGreedy<T>(units: T[], cost: (a: T, b: T) => number): [T, T][] {
	const remaining = [...units];
	const pairs: [T, T][] = [];
	while (remaining.length >= 2) {
		const home = remaining.shift()!;
		let bestIndex = 0;
		let bestCost = Infinity;
		for (let i = 0; i < remaining.length; i++) {
			const c = cost(home, remaining[i]);
			if (c < bestCost) {
				bestCost = c;
				bestIndex = i;
			}
		}
		pairs.push([home, remaining.splice(bestIndex, 1)[0]]);
	}
	return pairs;
}

/** Rotation: each team meets every other team once before any rematch. Never consults standings. */
function matchLeastRecentlyFaced(
	teams: Standing[],
	opponentCounts: Map<string, number>,
	random: () => number
): [Standing, Standing][] {
	// The shuffle is what randomizes the choice among equally-cheap matchings, so a schedule
	// doesn't lock into the same rotation every night.
	const shuffled = shuffle(teams, random);
	const cost = (a: Standing, b: Standing) => opponentCounts.get(opponentKey(a.id, b.id)) ?? 0;
	return shuffled.length <= EXACT_MATCHING_LIMIT
		? matchPairsExact(shuffled, cost)
		: matchPairsGreedy(shuffled, cost);
}

/** Rank-based: court 1 is 1st vs 2nd, court 2 is 3rd vs 4th, and so on. */
function pairTeamsByRank(teams: Standing[]): [Standing, Standing][] {
	const ranked = rankStandings(teams);
	const pairs: [Standing, Standing][] = [];
	for (let i = 0; i + 2 <= ranked.length; i += 2) pairs.push([ranked[i], ranked[i + 1]]);
	return pairs;
}

function buildCourts(pairs: [Standing, Standing][], teams: Team[]): CourtMatch[] {
	const byId = new Map(teams.map((team) => [team.id, team]));
	return pairs.flatMap(([home, away], index) => {
		const homeTeam = byId.get(home.id);
		const awayTeam = byId.get(away.id);
		if (!homeTeam || !awayTeam) return [];
		return [
			{
				court: index + 1,
				teamA: homeTeam.playerIds,
				teamB: awayTeam.playerIds,
				teamAId: homeTeam.id,
				teamBId: awayTeam.id
			}
		];
	});
}

export interface GenerateTeamRoundOptions {
	/** 'mexicano' = rank-based, top teams meet. 'americano' = rotation, least-recently-faced. */
	format?: PairingFormat;
	opponentCounts?: Map<string, number>;
	random?: () => number;
}

/** Teams-mode round. `sittingOut` holds team ids, matching how standings are keyed in this mode. */
export function generateTeamRound(
	teamStandings: Standing[],
	teams: Team[],
	courtCount: number,
	options: GenerateTeamRoundOptions = {}
): RoundPlan {
	const { format = 'mexicano', opponentCounts = new Map(), random = Math.random } = options;
	const { selected, sittingOut } = selectEligibleUnits(teamStandings, courtCount, random, 2);
	const pairs =
		format === 'americano'
			? matchLeastRecentlyFaced(selected, opponentCounts, random)
			: pairTeamsByRank(selected);
	return { courts: buildCourts(pairs, teams), sittingOut };
}

/** Final round: the top courtCount*2 teams play 1v2, 3v4, ... Everyone else sits out.
 *  pairingStyle has no meaning here - the pairs are given, not split out of a group of four. */
export function generateTeamFinalRoundPlan(
	teamStandings: Standing[],
	teams: Team[],
	courtCount: number
): RoundPlan {
	const ranked = rankStandings(teamStandings.filter((t) => !t.benched));
	const playableCourts = Math.min(courtCount, Math.floor(ranked.length / 2));
	const selected = ranked.slice(0, playableCourts * 2);
	const selectedIds = new Set(selected.map((t) => t.id));
	const sittingOut = teamStandings.filter((t) => !selectedIds.has(t.id)).map((t) => t.id);

	const pairs: [Standing, Standing][] = [];
	for (let i = 0; i + 2 <= selected.length; i += 2) pairs.push([selected[i], selected[i + 1]]);

	return { courts: buildCourts(pairs, teams), sittingOut };
}
