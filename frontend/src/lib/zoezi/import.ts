import { makeId } from '../id';
import type { Player, Tournament } from '../types';

export const ZOEZI_ORIGIN = 'https://korpenkalmarpickleballklubb.zoezi.se';
export interface ZoeziImport {
	version: 1;
	origin: typeof ZOEZI_ORIGIN;
	workout: { id: number; title: string; startTime: string };
	participants: { id: number; name: string }[];
}
export type ImportChoice = { memberId: number; action: 'add' | 'skip' | 'link'; playerId?: string };
const validId = (id: unknown): id is number => Number.isSafeInteger(id) && Number(id) > 0;
const validText = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0 && s.length <= 300;

export function parseImport(text: string): ZoeziImport {
	if (text.length > 250_000) throw new Error('Import is too large. Copy a single session.');
	let data;
	try { data = JSON.parse(text); } catch { throw new Error('Paste the complete data copied by the Zoezi helper.'); }
	if (!data || data.version !== 1 || data.origin !== ZOEZI_ORIGIN ||
		!validId(data.workout?.id) || !validText(data.workout?.title) ||
		!validText(data.workout?.startTime) || !Array.isArray(data.participants) || data.participants.length > 1000) {
		throw new Error('This is not a supported Zoezi session export.');
	}
	const seen = new Set<number>();
	const participants = data.participants.map((p: { id?: unknown; name?: unknown } | null) => {
		if (!p || !validId(p.id) || !validText(p.name) || seen.has(p.id)) {
			throw new Error('The participant list contains invalid or repeated member IDs. Copy it again.');
		}
		seen.add(p.id);
		return { id: p.id, name: p.name.trim() };
	});
	return { version: 1, origin: ZOEZI_ORIGIN, workout: {
		id: data.workout.id, title: data.workout.title.trim(), startTime: data.workout.startTime
	}, participants };
}

export function importedPlayer(players: Player[], memberId: number): Player | undefined {
	return players.find(p => p.zoezi?.origin === ZOEZI_ORIGIN && p.zoezi.memberId === memberId);
}
export function nameMatches(players: Player[], name: string): Player[] {
	return players.filter(p => !p.zoezi && p.name.trim().toLocaleLowerCase('sv') === name.trim().toLocaleLowerCase('sv'));
}

export function applyImport(tournament: Tournament, input: ZoeziImport, choices: ImportChoice[], startingPoints: number): Tournament {
	const data = parseImport(JSON.stringify(input));
	if (!Number.isFinite(startingPoints) || startingPoints < 0) throw new Error('Choose a starting score of zero or higher.');
	const players = tournament.players.map(p => ({ ...p }));
	const chosen = new Set<number>();
	for (const choice of choices) {
		if (chosen.has(choice.memberId)) throw new Error('A participant was selected more than once.');
		chosen.add(choice.memberId);
		const member = data.participants.find(p => p.id === choice.memberId);
		if (!member) throw new Error('Unknown participant. Preview the import again.');
		if (choice.action === 'skip' || importedPlayer(players, member.id)) continue;
		const zoezi = { origin: ZOEZI_ORIGIN, memberId: member.id, workoutId: data.workout.id };
		if (choice.action === 'link') {
			const player = players.find(p => p.id === choice.playerId);
			if (!player || player.zoezi) throw new Error('That player is already linked or no longer available.');
			player.zoezi = zoezi;
		} else if (choice.action === 'add') {
			players.push({ id: makeId(), name: member.name, active: true, startingPoints, zoezi });
		} else throw new Error('Choose how to import every participant.');
	}
	return { ...tournament, players };
}
