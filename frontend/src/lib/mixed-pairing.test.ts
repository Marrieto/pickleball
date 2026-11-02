import { expect, test } from 'vitest';
import { generateMixedRound } from './mixed-pairing';
import type { Standing, Team } from './types';
const standings: Standing[] = Array.from({ length: 9 }, (_, i) => ({
 id: String(i), gamesPlayed: 0, totalPoints: i, wins: 0, roundsSincePlayed: 0,
 timesSatOut: 0, adjustedScore: i, benched: false
}));
const teams: Team[] = [{ id: 'pair', playerIds: ['0', '8'], active: true, startingPoints: 0 }];
for (const format of ['americano', 'mexicano'] as const) {
 for (const final of [false, true]) {
  test(`${format}, final=${final}: pairs play or rest together, with no duplicate players`, () => {
   const plan = generateMixedRound(standings, 2, teams, { format, random: () => 0.5 }, final);
   const sides = plan.courts.flatMap(c => [c.teamA, c.teamB]);
   expect(plan.courts).toHaveLength(2);
   expect(new Set(sides.flat()).size).toBe(8);
   expect(sides.some(s => s.includes('0') && s.includes('8')) ||
    (plan.sittingOut.includes('0') && plan.sittingOut.includes('8'))).toBe(true);
   expect([...sides.flat(), ...plan.sittingOut].sort()).toEqual(standings.map(p => p.id).sort());
  });
 }
}
test('benching one partner rests both, while singles can still play', () => {
 const plan = generateMixedRound(standings.map(p => ({ ...p, benched: p.id === '0' })), 2, teams);
 expect(plan.courts).toHaveLength(1);
 expect(plan.sittingOut).toEqual(expect.arrayContaining(['0', '8']));
});
test('all players may have fixed partners', () => {
 const pairs = Array.from({ length: 4 }, (_, i) => ({ ...teams[0], id: String(i), playerIds: [String(i * 2), String(i * 2 + 1)] as [string, string] }));
 const plan = generateMixedRound(standings.slice(0, 8), 2, pairs);
 expect(plan.courts).toHaveLength(2);
 for (const pair of pairs) expect(plan.courts.flatMap(c => [c.teamA, c.teamB])).toContainEqual(pair.playerIds);
});
