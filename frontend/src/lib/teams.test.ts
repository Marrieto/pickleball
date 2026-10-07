import { describe, expect, test } from 'vitest';
import { playableTeams, teamName, unassignedActivePlayers, validateTeams } from './teams';
import type { Player, Team } from './types';

function player(id: string, overrides: Partial<Player> = {}): Player {
	return { id, name: id.toUpperCase(), active: true, startingPoints: 0, ...overrides };
}

function team(id: string, a: string, b: string, overrides: Partial<Team> = {}): Team {
	return { id, playerIds: [a, b], active: true, startingPoints: 0, ...overrides };
}

const four = [player('a'), player('b'), player('c'), player('d')];

describe('playableTeams', () => {
	test('excludes disbanded teams and teams whose member went inactive', () => {
		const players = [...four, player('e', { active: false })];
		const teams = [
			team('t1', 'a', 'b'),
			team('t2', 'c', 'd', { active: false }),
			team('t3', 'e', 'a')
		];
		expect(playableTeams(players, teams).map((t) => t.id)).toEqual(['t1']);
	});
});

describe('teamName', () => {
	test('joins member names, prefers a custom name, tolerates a missing player', () => {
		expect(teamName(team('t1', 'a', 'b'), four)).toBe('A & B');
		expect(teamName(team('t1', 'a', 'b', { name: 'The Dinkers' }), four)).toBe('The Dinkers');
		expect(teamName(team('t1', 'a', 'zz'), four)).toBe('A & ?');
	});
});

describe('validateTeams', () => {
	test('passes with two complete teams', () => {
		const result = validateTeams(four, [team('t1', 'a', 'b'), team('t2', 'c', 'd')]);
		expect(result.ok).toBe(true);
		expect(result.playableTeamCount).toBe(2);
	});

	test('an odd headcount surfaces as exactly one unassigned player', () => {
		const players = [...four, player('e')];
		const result = validateTeams(players, [team('t1', 'a', 'b'), team('t2', 'c', 'd')]);
		expect(result.ok).toBe(false);
		expect(result.unassignedPlayerIds).toEqual(['e']);
	});

	test('blocks on fewer than two playable teams', () => {
		expect(validateTeams([player('a'), player('b')], [team('t1', 'a', 'b')]).ok).toBe(false);
	});

	test('flags a player on two active teams', () => {
		const result = validateTeams(four, [team('t1', 'a', 'b'), team('t2', 'a', 'c')]);
		expect(result.ok).toBe(false);
		expect(result.duplicatePlayerIds).toEqual(['a']);
	});

	test('flags a team whose member was removed, and frees the partner', () => {
		const players = [player('a'), player('b', { active: false }), player('c'), player('d')];
		const result = validateTeams(players, [team('t1', 'a', 'b'), team('t2', 'c', 'd')]);
		expect(result.ok).toBe(false);
		expect(result.brokenTeamIds).toEqual(['t1']);
		expect(result.unassignedPlayerIds).toEqual(['a']);
	});
});

describe('unassignedActivePlayers', () => {
	test('ignores inactive players and counts members of unplayable teams as free', () => {
		const players = [player('a'), player('b'), player('c', { active: false })];
		expect(unassignedActivePlayers(players, [team('t1', 'a', 'c')]).map((p) => p.id)).toEqual([
			'a',
			'b'
		]);
	});
});
