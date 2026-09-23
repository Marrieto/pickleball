import type { MatchScore, ScoringMode } from './types';

/** How high the score picker's number grid should go. firstTo extends past the target so
 *  win-by-2 finishes can still be recorded (the old typed input allowed this, unenforced).
 *  bestOf stays capped exactly at the target, since its point pool is fixed. */
export function pickerMax(scoringMode: ScoringMode, targetScore: number): number {
	return scoringMode === 'bestOf' ? targetScore : targetScore + 4;
}

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
