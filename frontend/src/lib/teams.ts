import type { Player, Team } from './types';

export interface TeamValidation {
	ok: boolean;
	/** Active players belonging to no playable team. An odd headcount shows up here as length 1. */
	unassignedPlayerIds: string[];
	/** Active players somehow on more than one active team. */
	duplicatePlayerIds: string[];
	/** Active teams with a missing or inactive member - they can't field two players. */
	brokenTeamIds: string[];
	playableTeamCount: number;
}

/** A team can only play if it is active AND both its members are still active players. */
export function playableTeams(players: Player[], teams: Team[]): Team[] {
	const activeIds = new Set(players.filter((p) => p.active).map((p) => p.id));
	return teams.filter(
		(team) => team.active && team.playerIds.every((id) => activeIds.has(id))
	);
}

/** "Anna & Bo", or a custom name when one is set. */
export function teamName(team: Team, players: Player[]): string {
	if (team.name?.trim()) return team.name.trim();
	return team.playerIds
		.map((id) => players.find((p) => p.id === id)?.name ?? '?')
		.join(' & ');
}

export function unassignedActivePlayers(players: Player[], teams: Team[]): Player[] {
	const paired = new Set(playableTeams(players, teams).flatMap((team) => team.playerIds));
	return players.filter((p) => p.active && !paired.has(p.id));
}

/** The single source of truth for the "warn and block" rule: rounds can't be generated unless `ok`. */
export function validateTeams(players: Player[], teams: Team[]): TeamValidation {
	const playable = playableTeams(players, teams);
	const activeIds = new Set(players.filter((p) => p.active).map((p) => p.id));

	const seen = new Map<string, number>();
	for (const team of teams.filter((t) => t.active)) {
		for (const id of team.playerIds) seen.set(id, (seen.get(id) ?? 0) + 1);
	}

	const brokenTeamIds = teams
		.filter((team) => team.active && !team.playerIds.every((id) => activeIds.has(id)))
		.map((team) => team.id);

	const duplicatePlayerIds = [...seen.entries()]
		.filter(([id, count]) => count > 1 && activeIds.has(id))
		.map(([id]) => id);

	const unassignedPlayerIds = unassignedActivePlayers(players, teams).map((p) => p.id);

	return {
		ok:
			unassignedPlayerIds.length === 0 &&
			duplicatePlayerIds.length === 0 &&
			brokenTeamIds.length === 0 &&
			playable.length >= 2,
		unassignedPlayerIds,
		duplicatePlayerIds,
		brokenTeamIds,
		playableTeamCount: playable.length
	};
}
