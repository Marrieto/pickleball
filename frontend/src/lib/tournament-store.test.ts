import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TournamentStore } from './tournament-store.svelte';
import { createTournament } from './tournament-actions';

vi.mock('esm-env', () => ({ BROWSER: true, DEV: true, NODE: false }));

beforeEach(() => localStorage.clear());

describe('leaderboard sit-outs', () => {
	test('counts prior rounds only, regardless of viewed round, and includes them when finals start', () => {
		const store = new TournamentStore();
		store.startTournament('Night', 1, 11);
		for (const name of ['A', 'B', 'C', 'D', 'E']) store.addPlayer(name);
		store.generateNextRound();
		const firstSitter = store.currentRound!.sittingOut[0];
		expect(store.standings.every((standing) => standing.timesSatOut === 0)).toBe(true);
		store.recordScore(store.currentRound!.id, 1, 11, 5);
		expect(store.standings.find((standing) => standing.id === firstSitter)?.timesSatOut).toBe(0);
		store.generateNextRound();
		const secondSitter = store.currentRound!.sittingOut[0];
		expect(store.standings.find((standing) => standing.id === firstSitter)?.timesSatOut).toBe(1);
		expect(store.standings.reduce((sum, standing) => sum + standing.timesSatOut, 0)).toBe(1);
		store.goToRound(0);
		expect(store.standings.reduce((sum, standing) => sum + standing.timesSatOut, 0)).toBe(1);
		store.goToRound(1);
		store.generateFinalRound('standard');
		expect(store.standings.reduce((sum, standing) => sum + standing.timesSatOut, 0)).toBe(2);
		expect(store.standings.find((standing) => standing.id === secondSitter)?.timesSatOut).toBeGreaterThan(0);
		store.undo();
		expect(store.standings.reduce((sum, standing) => sum + standing.timesSatOut, 0)).toBe(1);
	});
});

describe('device preferences', () => {
	test('theme persists on the landing page and across tournament lifecycles', () => {
		let store = new TournamentStore();
		expect(store.darkMode).toBe(false);
		store.toggleDarkMode();
		store = new TournamentStore();
		expect(store.tournament).toBeNull();
		expect(store.darkMode).toBe(true);
		store.startTournament('Night', 2, 11);
		expect(store.tournament?.settings.darkMode).toBe(true);
		store.toggleDarkMode();
		expect(new TournamentStore().darkMode).toBe(false);
		store.toggleDarkMode();
		store.endTournament();
		expect(new TournamentStore().darkMode).toBe(true);
	});

	test('court numbers and sides survive reloads and temporarily using fewer courts', () => {
		let store = new TournamentStore();
		store.startTournament('First', 3, 11);
		store.setCourtLabel(1, 'teamA', ' Glass ');
		store.setCourtLabel(1, 'teamB', 'Wall');
		store.setCourtLabel(3, 'teamA', 'Window');
		store.setCourtLabel(3, 'teamB', 'Door');
		store = new TournamentStore();
		expect(store.tournament?.courtLabels[1]).toEqual({ teamA: 'Glass', teamB: 'Wall' });
		store.endTournament();
		store.startTournament('Smaller', 1, 11);
		store.setCourtLabel(1, 'teamA', 'Net');
		store.setCourtLabel(1, 'teamB', '   ');
		store.endTournament();
		store = new TournamentStore();
		store.startTournament('Larger', 3, 11);
		expect(store.tournament?.courtLabels).toEqual({
			1: { teamA: 'Net' },
			3: { teamA: 'Window', teamB: 'Door' }
		});
	});

	test('adopts legacy tournament preferences once, including labels before ending', () => {
		const legacy = createTournament('Existing', 2, 11, { darkMode: true });
		legacy.courtLabels = { 2: { teamB: 'Wall' } };
		localStorage.setItem('americano:tournament', JSON.stringify(legacy));
		let store = new TournamentStore();
		expect(store.darkMode).toBe(true);
		store.endTournament();
		store.startTournament('Next', 2, 11);
		expect(store.tournament?.courtLabels).toEqual(legacy.courtLabels);
		store.toggleDarkMode();
		store.setCourtLabel(2, 'teamB', '');
		localStorage.setItem('americano:tournament', JSON.stringify(legacy));
		store = new TournamentStore();
		expect(store.darkMode).toBe(false);
		store.endTournament();
		store.startTournament('Again', 2, 11);
		expect(store.tournament?.courtLabels[2]?.teamB).toBeUndefined();
	});
});
