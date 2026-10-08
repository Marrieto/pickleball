import type { EntryMode, PairingFormat, PairingStyle, ScoringMode } from './types';

export const SCORE_DEFAULTS: Record<ScoringMode, { default: number; min: number; max: number }> = {
	firstTo: { default: 11, min: 2, max: 15 },
	bestOf: { default: 21, min: 4, max: 40 }
};
export const MAX_COURTS = 12;
const MAX_PLAYERS = 60;
const MAX_NAME_LENGTH = 40;

export interface SetupConfig {
	name: string;
	courtCount: number;
	targetScore: number;
	scoringMode: ScoringMode;
	entryMode: EntryMode;
	pairingFormat: PairingFormat;
	pairingStyle: PairingStyle;
}

export const SETUP_DEFAULTS: SetupConfig = {
	name: 'Pickleball Night',
	courtCount: 2,
	targetScore: SCORE_DEFAULTS.firstTo.default,
	scoringMode: 'firstTo',
	entryMode: 'individual',
	pairingFormat: 'mexicano',
	pairingStyle: 'standard'
};

export interface ParsedSetupLink {
	config: Partial<SetupConfig>;
	players: string[];
}

const oneOf = <T extends string>(value: string | null, options: readonly T[]): T | undefined =>
	options.find((option) => option === value);

const intInRange = (value: string | null, min: number, max: number): number | undefined => {
	if (value === null || !/^\d+$/.test(value.trim())) return undefined;
	const n = Number(value);
	return n >= min && n <= max ? n : undefined;
};

/** Clean a list of names: trim, drop empties/overlong, cap, and dedupe case-insensitively. */
export function cleanNames(names: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of names) {
		const name = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
		const key = name.toLocaleLowerCase('sv');
		if (!name || name.length > MAX_NAME_LENGTH || seen.has(key)) continue;
		seen.add(key);
		result.push(name);
		if (result.length >= MAX_PLAYERS) break;
	}
	return result;
}

/** Reads a setup link's query string. Unknown or invalid values are ignored, never thrown on. */
export function parseSetupLink(search: string): ParsedSetupLink {
	const params = new URLSearchParams(search);
	const config: Partial<SetupConfig> = {};

	const name = params.get('name')?.trim().slice(0, 80);
	if (name) config.name = name;
	const courts = intInRange(params.get('courts'), 1, MAX_COURTS);
	if (courts !== undefined) config.courtCount = courts;
	const scoringMode = oneOf(params.get('scoring'), ['firstTo', 'bestOf'] as const);
	if (scoringMode) config.scoringMode = scoringMode;
	const mode = scoringMode ?? SETUP_DEFAULTS.scoringMode;
	const score = intInRange(params.get('score'), SCORE_DEFAULTS[mode].min, SCORE_DEFAULTS[mode].max);
	if (score !== undefined) config.targetScore = score;
	else if (scoringMode) config.targetScore = SCORE_DEFAULTS[mode].default;
	const entryMode = oneOf(params.get('entry'), ['individual', 'teams'] as const);
	if (entryMode) config.entryMode = entryMode;
	const format = oneOf(params.get('format'), ['mexicano', 'americano'] as const);
	if (format) config.pairingFormat = format;
	const style = oneOf(params.get('style'), ['standard', 'alternate'] as const);
	if (style) config.pairingStyle = style;

	return { config, players: cleanNames(params.getAll('player').concat((params.get('players') ?? '').split(','))) };
}

/**
 * Builds a link that recreates a setup on another device. Values equal to the defaults are
 * left out so the URL (often pasted into a shortener) stays small.
 */
export function buildSetupLink(pageUrl: string, config: SetupConfig, playerNames: string[]): string {
	const url = new URL(pageUrl);
	url.search = '';
	url.hash = '';
	const set = (key: string, value: string | number, fallback: string | number) => {
		if (value !== fallback) url.searchParams.set(key, String(value));
	};
	set('name', config.name.trim() || SETUP_DEFAULTS.name, SETUP_DEFAULTS.name);
	set('courts', config.courtCount, SETUP_DEFAULTS.courtCount);
	set('scoring', config.scoringMode, SETUP_DEFAULTS.scoringMode);
	set('score', config.targetScore, SCORE_DEFAULTS[config.scoringMode].default);
	set('entry', config.entryMode, SETUP_DEFAULTS.entryMode);
	set('format', config.pairingFormat, SETUP_DEFAULTS.pairingFormat);
	set('style', config.pairingStyle, SETUP_DEFAULTS.pairingStyle);
	const names = cleanNames(playerNames);
	if (names.length) url.searchParams.set('players', names.join(','));
	return url.toString();
}
