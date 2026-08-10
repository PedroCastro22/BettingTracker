import type {
  Match,
  MatchPredictionResults,
  OptaMatchPrediction,
  OptaMetricSet,
  OptaTeamStats,
  PredictionLine,
  PredictionResult,
} from '../types';

// Display a prediction line in the compact text format used throughout the UI.
export function formatLine(line?: PredictionLine): string {
  if (!line) {
    return '-';
  }

  return `${line.direction === 'over' ? 'Over' : 'Under'} ${line.value}`;
}

// Convert form fields into a typed prediction line, skipping empty or invalid values.
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

// A match is complete once both final score fields have been entered.
export function isMatchCompleted(match: Match): boolean {
  return typeof match.actualHomeGoals === 'number' && typeof match.actualAwayGoals === 'number';
}

// Compare one selected over/under line with the actual match stat.
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

// Calculate all result badges for one tracked match.
export function calculateMatchResults(match: Match): MatchPredictionResults {
  // Total goals can only be scored after both final team scores are known.
  const actualTotalGoals =
    isMatchCompleted(match) ? Number(match.actualHomeGoals) + Number(match.actualAwayGoals) : undefined;

  // Individual line results are delegated to the same helper to keep rules consistent.
  const goals = calculateLineResult(match.predictedTotalGoalsLine, actualTotalGoals);
  const totalShots = calculateLineResult(match.predictedTotalShotsLine, match.actualTotalShots);
  const shotsOnTarget = calculateLineResult(match.predictedShotsOnTargetLine, match.actualShotsOnTarget);

  // Exact scoreline is a separate result because it compares two team-specific scores.
  let exactScoreline: PredictionResult = 'pending';
  if (isMatchCompleted(match)) {
    exactScoreline =
      match.predictedHomeGoals === match.actualHomeGoals && match.predictedAwayGoals === match.actualAwayGoals
        ? 'win'
        : 'loss';
  }

  // Combined counts selected stat lines only and wins only when every selected stat wins.
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

// Aggregate a dashboard accuracy card from a chosen result type.
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

// Round model outputs to display-friendly decimal precision.
function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Keep blended model projections inside sensible football-stat bounds.
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Blend attacking xG with the opponent's defensive xG allowed, then adjust for finishing.
function blendedExpectedGoals(attack: OptaMetricSet, opponentDefense: OptaMetricSet): number {
  const xgBase = attack.avgXg * 0.6 + opponentDefense.avgXg * 0.4;
  const finishingAdjustment = (attack.goalsVsXg * 0.65 + opponentDefense.goalsVsXg * 0.35) * 0.45;

  return roundTo(clamp(xgBase + finishingAdjustment, 0.05, 5));
}

// Blend a team's attacking volume with the opponent's defensive volume allowed.
function blendedVolume(attackValue: number, opponentDefenseValue: number): number {
  return roundTo(clamp(attackValue * 0.55 + opponentDefenseValue * 0.45, 0, 45));
}

// Convert a raw projection into a common half-point over/under line suggestion.
function suggestedHalfLine(projection: number): PredictionLine {
  const value = Math.max(0.5, Math.floor(projection) + 0.5);

  return {
    direction: projection > value ? 'over' : 'under',
    value,
  };
}

// Goal-line suggestions are intentionally limited to these two betting options.
function suggestedGoalLine(totalXg: number): PredictionLine {
  return totalXg < 2.5
    ? { direction: 'under', value: 2.5 }
    : { direction: 'over', value: 1.5 };
}

// Generate all match prediction values from home and away Opta team profiles.
export function calculateOptaMatchPrediction(home: OptaTeamStats, away: OptaTeamStats): OptaMatchPrediction {
  // Team goals use attacking quality against the opponent's defensive concessions.
  function xgToGoals(xg: number): number {
    // Extremely low attacking output
    if (xg < 0.75) return 0;

    // Weak but capable of scoring
    if (xg < 1.45) return 1;

    // Strong chance of scoring 2
    if (xg < 2.05) return 2;

    // Elite attacking projection
    if (xg < 2.75) return 3;

    // Chaos / elite mismatch games
    return 4;
  }

  const blendedHomeXG = blendedExpectedGoals(home.attacking, away.defending);
  const blendedAwayXG = blendedExpectedGoals(away.attacking, home.defending);

  // Convert xG into actual football scoreline predictions
  let predictedHomeGoals = xgToGoals(blendedHomeXG);
  let predictedAwayGoals = xgToGoals(blendedAwayXG);

  // Small adjustment to avoid too many unrealistic 2-2 / 3-3 projections
  const totalXG = blendedHomeXG + blendedAwayXG;

  // If game projects low-event overall,
  // reduce one side by 1 goal where appropriate
  if (totalXG < 2.3) {
    if (predictedHomeGoals > 1 && predictedAwayGoals > 1) {
      predictedAwayGoals -= 1;
    }
  }

  // Home advantage tiebreaker
  // If both teams map to same score but home xG is slightly higher
  if (
    predictedHomeGoals === predictedAwayGoals &&
    blendedHomeXG > blendedAwayXG + 0.15
  ) {
    predictedHomeGoals += 1;
  }

  // Same for away side
  if (
    predictedHomeGoals === predictedAwayGoals &&
    blendedAwayXG > blendedHomeXG + 0.15
  ) {
    predictedAwayGoals += 1;
  }

  // Shot and SoT volumes use the same attack-vs-defense blending approach.
  const predictedHomeShots = blendedVolume(home.attacking.avgShots, away.defending.avgShots);
  const predictedAwayShots = blendedVolume(away.attacking.avgShots, home.defending.avgShots);
  const predictedHomeShotsOnTarget = blendedVolume(home.attacking.avgShotsOnTarget, away.defending.avgShotsOnTarget);
  const predictedAwayShotsOnTarget = blendedVolume(away.attacking.avgShotsOnTarget, home.defending.avgShotsOnTarget);

  // Totals power the tracker line suggestions and the Opta tab summary cards.
  const predictedTotalGoals = predictedHomeGoals + predictedAwayGoals;
  const predictedTotalShots = roundTo(predictedHomeShots + predictedAwayShots);
  const predictedShotsOnTarget = roundTo(predictedHomeShotsOnTarget + predictedAwayShotsOnTarget);

  return {
    homeTeam: home.team,
    awayTeam: away.team,
    predictedHomeGoals,
    predictedAwayGoals,
    predictedTotalGoals,
    predictedTotalShots,
    predictedShotsOnTarget,
    predictedTotalGoalsLine: suggestedGoalLine(totalXG),
    predictedTotalShotsLine: suggestedHalfLine(predictedTotalShots),
    predictedShotsOnTargetLine: suggestedHalfLine(predictedShotsOnTarget),
  };
}
