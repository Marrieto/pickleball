import { partnerKey, shuffle, type GenerateRoundOptions } from './pairing';
import { rankStandings } from './standings';
import type { Standing, Team, RoundPlan } from './types';

export function generateMixedRound(
	standings: Standing[], courtCount: number, teams: Team[],
	options: GenerateRoundOptions = {}, final = false
): RoundPlan {
	const random = options.random ?? Math.random;
	const byId = new Map(standings.map(p => [p.id, p]));
	const paired = new Set<string>();
	const units: Standing[][] = [];
	for (const team of teams.filter(t => t.active)) {
		const members = team.playerIds.map(id => byId.get(id));
		if (members.some(p => !p) || team.playerIds.some(id => paired.has(id))) continue;
		team.playerIds.forEach(id => paired.add(id));
		units.push(members as Standing[]);
	}
	units.push(...standings.filter(p => !paired.has(p.id)).map(p => [p]));
	const priority = final ? rankStandings(standings) : shuffle(standings, random).sort((a, b) =>
		b.roundsSincePlayed - a.roundsSincePlayed || a.gamesPlayed - b.gamesPlayed);
	const ranks = new Map(priority.map((p, i) => [p.id, i]));
	const eligible = units.filter(unit => unit.every(p => !p.benched));
	// Keep the best whole-unit selection for each possible number of occupied places.
	const selections = new Map<number, { units: Standing[][]; cost: number }>([[0, { units: [], cost: 0 }]]);
	for (const unit of eligible) {
		for (const [size, selection] of [...selections].sort((a, b) => b[0] - a[0])) {
			const next = size + unit.length;
			if (next > courtCount * 4) continue;
			const cost = selection.cost + unit.reduce((sum, p) => sum + ranks.get(p.id)!, 0);
			if (!selections.has(next) || cost < selections.get(next)!.cost)
				selections.set(next, { units: [...selection.units, unit], cost });
		}
	}
	const size = Math.max(...[...selections.keys()].filter(n => n % 4 === 0));
	const selected = selections.get(size)!.units;
	const sides = selected.filter(unit => unit.length === 2);
	const singles = selected.filter(unit => unit.length === 1).flat();
	const ranked = options.format !== 'americano' || final;
	const remaining = ranked ? rankStandings(singles) : shuffle(singles, random);
	while (remaining.length) {
		if (ranked) {
			const group = remaining.splice(0, 4);
			if (group.length === 2) sides.push(group);
			else if (options.pairingStyle === 'alternate') sides.push([group[0], group[2]], [group[1], group[3]]);
			else sides.push([group[0], group[3]], [group[1], group[2]]);
			continue;
		}
		const first = remaining.shift()!;
		let index = 0;
		for (let i = 1; i < remaining.length; i++) {
			const count = (p: Standing) => options.partnerCounts?.get(partnerKey(first.id, p.id)) ?? 0;
			if (count(remaining[i]) < count(remaining[index])) index = i;
		}
		sides.push([first, remaining.splice(index, 1)[0]]);
	}
	const ordered = ranked ? sides.sort((a, b) =>
		b.reduce((sum, p) => sum + p.adjustedScore, 0) - a.reduce((sum, p) => sum + p.adjustedScore, 0)
	) : shuffle(sides, random);
	const courts: RoundPlan['courts'] = [];
	for (let i = 0; i < ordered.length; i += 2) {
		courts.push({ court: courts.length + 1,
			teamA: [ordered[i][0].id, ordered[i][1].id],
			teamB: [ordered[i + 1][0].id, ordered[i + 1][1].id] });
	}
	const playing = new Set(ordered.flat().map(p => p.id));
	return { courts, sittingOut: standings.filter(p => !playing.has(p.id)).map(p => p.id) };
}
