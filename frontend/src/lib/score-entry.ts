import type { MatchScore, ScoringMode } from './types';

/** Computes the next score after tapping one team's picker. In bestOf mode this is symmetric: tapping
 *  either team sets that team's score and auto-fills the other as max - value. In firstTo mode only
 *  the tapped team's score changes. */
export function applyScoreSelection(
	scoringMode: ScoringMode,
	max: number,
	selectedTeam: 'A' | 'B',
	value: number,
	current: MatchScore
): MatchScore {
	if (scoringMode !== 'bestOf') {
		return selectedTeam === 'A'
			? { ...current, teamAPoints: value }
			: { ...current, teamBPoints: value };
	}
	const other = max - value;
	return selectedTeam === 'A'
		? { teamAPoints: value, teamBPoints: other }
		: { teamAPoints: other, teamBPoints: value };
}
