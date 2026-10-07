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

describe('device roster persistence', () => {
	test('players from the last session are restored into the next one, with stable ids', () => {
		const store = new TournamentStore();
		store.startTournament('Tuesday', 2, 11);
		for (const name of ['Anna', 'Bo', 'Carl', 'Dave']) store.addPlayer(name);
		const before = store.tournament!.players.map((p) => ({ id: p.id, name: p.name }));

		store.endTournament();
		store.startTournament('Wednesday', 1, 21, { pairingFormat: 'americano' });

		expect(store.tournament!.players.map((p) => ({ id: p.id, name: p.name }))).toEqual(before);
		expect(store.tournament!.players.every((p) => p.active && p.startingPoints === 0)).toBe(true);
	});

	test('a removed player leaves the next lineup but stays available to re-add', () => {
		const store = new TournamentStore();
		store.startTournament('Tuesday', 1, 11);
		for (const name of ['Anna', 'Bo']) store.addPlayer(name);
		const bo = store.tournament!.players.find((p) => p.name === 'Bo')!;
		store.removePlayer(bo.id);

		store.endTournament();
		store.startTournament('Wednesday', 1, 11);

		expect(store.tournament!.players.map((p) => p.name)).toEqual(['Anna']);
		expect(store.availableRoster.map((entry) => entry.name)).toEqual(['Bo']);

		store.addPlayer('Bo', 0, bo.id);
		expect(store.tournament!.players.filter((p) => p.active).map((p) => p.name)).toEqual(['Anna', 'Bo']);
		expect(store.availableRoster).toEqual([]);
	});

	test('re-adding a soft-deleted player reactivates them instead of duplicating', () => {
		const store = new TournamentStore();
		store.startTournament('Tuesday', 1, 11);
		store.addPlayer('Anna');
		const anna = store.tournament!.players[0];
		store.removePlayer(anna.id);
		store.addPlayer('Anna', 0, anna.id);

		expect(store.tournament!.players).toHaveLength(1);
		expect(store.tournament!.players[0]).toMatchObject({ id: anna.id, active: true });
	});

	test('forgetting a player removes them from the device for good', () => {
		const store = new TournamentStore();
		store.startTournament('Tuesday', 1, 11);
		store.addPlayer('Anna');
		const anna = store.tournament!.players[0];
		store.removePlayer(anna.id);
		store.forgetRosterPlayer(anna.id);

		store.endTournament();
		store.startTournament('Wednesday', 1, 11);

		expect(store.tournament!.players).toEqual([]);
		expect(store.availableRoster).toEqual([]);
	});

	test('court labels still survive a new tournament alongside the roster', () => {
		const store = new TournamentStore();
		store.startTournament('Tuesday', 1, 11);
		store.addPlayer('Anna');
		store.setCourtLabel(1, 'teamA', 'glasvägg');

		store.endTournament();
		store.startTournament('Wednesday', 1, 11);

		expect(store.tournament!.courtLabels[1]?.teamA).toBe('glasvägg');
		expect(store.tournament!.players.map((p) => p.name)).toEqual(['Anna']);
	});
});

describe('teams mode', () => {
	/** A tournament persisted before teams mode existed: no `teams` key, no `settings.entryMode`. */
	function writeLegacyTournament() {
		const legacy = createTournament('Legacy', 1, 11) as unknown as Record<string, unknown>;
		delete legacy.teams;
		delete (legacy.settings as Record<string, unknown>).entryMode;
		localStorage.setItem('americano:tournament', JSON.stringify(legacy));
	}

	test('a tournament saved before teams mode still loads and plays as individual', () => {
		writeLegacyTournament();
		const store = new TournamentStore();

		expect(store.tournament!.teams).toEqual([]);
		expect(store.tournament!.settings.entryMode).toBe('individual');
		expect(store.isTeamMode).toBe(false);

		for (const name of ['A', 'B', 'C', 'D']) store.addPlayer(name);
		store.generateNextRound();

		expect(store.currentRound!.courts).toHaveLength(1);
		expect(store.currentRound!.courts[0].teamAId).toBeUndefined();
	});

	function teamStore(playerCount: number, courtCount: number): TournamentStore {
		const store = new TournamentStore();
		store.startTournament('Teams night', courtCount, 11, { entryMode: 'teams' });
		for (let i = 0; i < playerCount; i++) store.addPlayer(`P${i}`);
		const ids = store.tournament!.players.map((p) => p.id);
		for (let i = 0; i + 1 < ids.length; i += 2) store.createTeam(ids[i], ids[i + 1]);
		return store;
	}

	test('an unpaired player blocks generation until they are paired', () => {
		const store = teamStore(7, 2);
		expect(store.canGenerateRound).toBe(false);
		expect(store.unassignedPlayers.map((p) => p.name)).toEqual(['P6']);

		store.generateNextRound();
		expect(store.currentRound).toBeUndefined();

		store.addPlayer('P7');
		const [odd, extra] = store.unassignedPlayers;
		store.createTeam(odd.id, extra.id);

		expect(store.canGenerateRound).toBe(true);
		store.generateNextRound();
		expect(store.currentRound!.courts).toHaveLength(2);
	});

	test('the leaderboard is keyed by team, with names resolved from members', () => {
		const store = teamStore(8, 2);
		store.generateNextRound();
		const round = store.currentRound!;
		store.recordScore(round.id, 1, 11, 4);

		const teamIds = new Set(store.teams.map((t) => t.id));
		expect(store.standings).toHaveLength(4);
		expect(store.standings.every((s) => teamIds.has(s.id))).toBe(true);

		const winner = store.standings[0];
		expect(winner.totalPoints).toBe(11);
		expect(store.displayName(winner.id)).toBe(
			store.teams
				.find((t) => t.id === winner.id)!
				.playerIds.map((id) => store.tournament!.players.find((p) => p.id === id)!.name)
				.join(' & ')
		);
	});

	test('removing a player disbands their team and blocks play until the partner is re-paired', () => {
		const store = teamStore(4, 1);
		expect(store.canGenerateRound).toBe(true);

		const victim = store.teams[0].playerIds[0];
		store.removePlayer(victim);

		expect(store.teams).toHaveLength(1);
		expect(store.canGenerateRound).toBe(false);
		expect(store.unassignedPlayers).toHaveLength(1);
	});

	test('teams and scores survive a reload', () => {
		const store = teamStore(8, 2);
		store.generateNextRound();
		store.recordScore(store.currentRound!.id, 1, 11, 6);
		const expected = store.standings.map((s) => ({ id: s.id, totalPoints: s.totalPoints }));

		const reloaded = new TournamentStore();
		expect(reloaded.isTeamMode).toBe(true);
		expect(reloaded.teams).toHaveLength(4);
		expect(reloaded.standings.map((s) => ({ id: s.id, totalPoints: s.totalPoints }))).toEqual(
			expected
		);
	});
});
