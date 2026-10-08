import { describe, expect, test } from 'vitest';
import { addPlayer, createTournament, removePlayer } from '../tournament-actions';
import { applyImport, parseImport, ZOEZI_ORIGIN, type ZoeziImport } from './import';

const payload: ZoeziImport = { version: 1, origin: ZOEZI_ORIGIN,
	workout: { id: 266, title: 'Pickleball — Drop in', startTime: '2026-10-10 11:00:00' },
	participants: [{ id: 18, name: 'Alex Example' }, { id: 19, name: 'Alex Example' }] };
const choices = payload.participants.map(p => ({ memberId: p.id, action: 'add' as const }));

describe('Zoezi import', () => {
	test('validates the origin, version and member identities', () => {
		expect(parseImport(JSON.stringify(payload))).toEqual(payload);
		for (const invalid of ['bad json', 'null', JSON.stringify({ ...payload, origin: 'https://other.test' }),
			JSON.stringify({ ...payload, version: 2 }), JSON.stringify({ ...payload, participants: [null] }),
			JSON.stringify({ ...payload, participants: [payload.participants[0], payload.participants[0]] })]) {
			expect(() => parseImport(invalid)).toThrow();
		}
	});
	test('preserves same-name people and prevents duplicates across sessions and reloads', () => {
		const original = addPlayer(createTournament('Night', 2, 11), 'Existing', 3);
		const first = applyImport(original, payload, choices, 7);
		expect(first.players.map(p => p.name)).toEqual(['Existing', 'Alex Example', 'Alex Example']);
		expect(first.players.map(p => p.startingPoints)).toEqual([3, 7, 7]);
		const reloaded = JSON.parse(JSON.stringify(first));
		const repeated = applyImport(reloaded, { ...payload, workout: { ...payload.workout, id: 267 } }, choices, 99);
		expect(repeated).toEqual(first);
		expect(original.players).toHaveLength(1);
	});
	test('links manual players explicitly, preserving score and inactive status', () => {
		let original = addPlayer(createTournament('Night', 2, 11), 'Alex Example', 4);
		original = removePlayer(original, original.players[0].id);
		const linked = applyImport(original, payload, [{ memberId: 18, action: 'link', playerId: original.players[0].id }, { memberId: 19, action: 'skip' }], 9);
		expect(linked.players).toHaveLength(1);
		expect(linked.players[0]).toMatchObject({ active: false, startingPoints: 4, zoezi: { memberId: 18 } });
		expect(applyImport(linked, payload, [{ memberId: 18, action: 'add' }], 0)).toEqual(linked);
	});
	test('rejects conflicting links atomically and invalid scores', () => {
		const original = addPlayer(createTournament('Night', 2, 11), 'Alex Example');
		expect(() => applyImport(original, payload, choices.map(c => ({ ...c, action: 'link', playerId: original.players[0].id })), 0)).toThrow();
		expect(original.players[0].zoezi).toBeUndefined();
		for (const points of [-1, NaN, Infinity]) expect(() => applyImport(original, payload, choices, points)).toThrow();
	});
});
