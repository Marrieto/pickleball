import { describe, expect, test } from 'vitest';
import { SETUP_DEFAULTS, buildSetupLink, cleanNames, parseSetupLink, type SetupConfig } from './setup-link';

const page = 'https://example.github.io/pickleball/';

describe('parseSetupLink', () => {
	test('reads every supported parameter', () => {
		const parsed = parseSetupLink(
			'?name=Fredag%20Kv%C3%A4ll&courts=3&scoring=bestOf&score=24&entry=teams&format=americano&style=alternate&players=Martin,Casper%20Gyllenvind,%C3%85sa'
		);
		expect(parsed.config).toEqual({
			name: 'Fredag Kväll', courtCount: 3, scoringMode: 'bestOf', targetScore: 24,
			entryMode: 'teams', pairingFormat: 'americano', pairingStyle: 'alternate'
		});
		expect(parsed.players).toEqual(['Martin', 'Casper Gyllenvind', 'Åsa']);
	});
	test('ignores invalid values instead of throwing', () => {
		const parsed = parseSetupLink('?courts=99&score=abc&scoring=nope&entry=x&format=&style=zzz&name=%20');
		expect(parsed.config).toEqual({});
		expect(parsed.players).toEqual([]);
	});
	test('score is validated against the scoring mode, and switching mode resets it', () => {
		expect(parseSetupLink('?score=30').config.targetScore).toBeUndefined();
		expect(parseSetupLink('?scoring=bestOf&score=30').config.targetScore).toBe(30);
		expect(parseSetupLink('?scoring=bestOf').config.targetScore).toBe(21);
	});
});

describe('cleanNames', () => {
	test('trims, dedupes case-insensitively and drops empties and overlong names', () => {
		expect(cleanNames([' Martin ', 'martin', '', 'a,b', 'x'.repeat(41), 'Åsa'])).toEqual(['Martin', 'a b', 'Åsa']);
	});
});

describe('buildSetupLink', () => {
	const config: SetupConfig = { ...SETUP_DEFAULTS, name: 'Fredag', courtCount: 3, pairingFormat: 'americano' };
	test('omits defaults and round-trips through parseSetupLink', () => {
		const link = buildSetupLink(page + '?stale=1#x', config, ['Martin', 'Åsa, Lindahl']);
		const url = new URL(link);
		expect(url.searchParams.has('score')).toBe(false);
		expect(url.searchParams.has('stale')).toBe(false);
		expect(url.hash).toBe('');
		const parsed = parseSetupLink(url.search);
		expect(parsed.config).toMatchObject({ name: 'Fredag', courtCount: 3, pairingFormat: 'americano' });
		expect(parsed.players).toEqual(['Martin', 'Åsa Lindahl']);
	});
});
