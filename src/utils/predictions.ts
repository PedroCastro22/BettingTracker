import type { Match, MatchPredictionResults, PredictionLine, PredictionResult } from '../types';

export function formatLine(line?: PredictionLine): string {
  if (!line) {
    return '-';
  }

  return `${line.direction === 'over' ? 'Over' : 'Under'} ${line.value}`;
}

export function parseLine(direction: string, value: string): PredictionLine | undefined {
  if (!direction || value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return {
    direction: direction as PredictionLine['direction'],
    value: parsed,
  };
}

export function isMatchCompleted(match: Match): boolean {
  return typeof match.actualHomeGoals === 'number' && typeof match.actualAwayGoals === 'number';
}

function calculateLineResult(line: PredictionLine | undefined, actual?: number): PredictionResult {
  if (!line) {
    return 'not-selected';
  }

  if (typeof actual !== 'number') {
    return 'pending';
  }

  const didWin = line.direction === 'over' ? actual > line.value : actual < line.value;
  return didWin ? 'win' : 'loss';
}

// Accuracy logic lives here so UI components only display the calculated results.
// A combined prediction counts only the selected stat lines for a completed match:
// goals, total shots, and shots on target. It wins when every selected stat line wins.
export function calculateMatchResults(match: Match): MatchPredictionResults {
  const actualTotalGoals =
    isMatchCompleted(match) ? Number(match.actualHomeGoals) + Number(match.actualAwayGoals) : undefined;

  const goals = calculateLineResult(match.predictedTotalGoalsLine, actualTotalGoals);
  const totalShots = calculateLineResult(match.predictedTotalShotsLine, match.actualTotalShots);
  const shotsOnTarget = calculateLineResult(match.predictedShotsOnTargetLine, match.actualShotsOnTarget);

  let exactScoreline: PredictionResult = 'pending';
  if (isMatchCompleted(match)) {
    exactScoreline =
      match.predictedHomeGoals === match.actualHomeGoals && match.predictedAwayGoals === match.actualAwayGoals
        ? 'win'
        : 'loss';
  }

  const selectedStatResults = [goals, totalShots, shotsOnTarget].filter((result) => result !== 'not-selected');
  let combined: PredictionResult = 'not-selected';

  if (selectedStatResults.length > 0) {
    combined = selectedStatResults.some((result) => result === 'pending')
      ? 'pending'
      : selectedStatResults.every((result) => result === 'win')
        ? 'win'
        : 'loss';
  }

  return {
    goals,
    totalShots,
    shotsOnTarget,
    exactScoreline,
    combined,
  };
}

export function calculateAccuracy(matches: Match[], selector: (results: MatchPredictionResults) => PredictionResult) {
  const settled = matches
    .map((match) => selector(calculateMatchResults(match)))
    .filter((result) => result === 'win' || result === 'loss');

  const wins = settled.filter((result) => result === 'win').length;

  return {
    wins,
    total: settled.length,
    percentage: settled.length === 0 ? 0 : Math.round((wins / settled.length) * 100),
  };
}
