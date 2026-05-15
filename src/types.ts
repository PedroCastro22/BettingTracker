// Direction used by an over/under betting-style prediction line.
export type PredictionDirection = 'over' | 'under';

// One selectable prediction line, such as Over 2.5 goals or Under 9.5 SoT.
export type PredictionLine = {
  direction: PredictionDirection;
  value: number;
};

// Result states used by the dashboard and row badges.
export type PredictionResult = 'win' | 'loss' | 'pending' | 'not-selected';

// A tracked match stores pre-match predictions and optional final match stats.
export type Match = {
  id: string;
  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  predictedTotalGoalsLine?: PredictionLine;
  predictedTotalShotsLine?: PredictionLine;
  predictedShotsOnTargetLine?: PredictionLine;
  notes?: string;
  actualHomeGoals?: number;
  actualAwayGoals?: number;
  actualTotalShots?: number;
  actualShotsOnTarget?: number;
};

// Calculated result summary for each prediction category on a match.
export type MatchPredictionResults = {
  goals: PredictionResult;
  totalShots: PredictionResult;
  shotsOnTarget: PredictionResult;
  exactScoreline: PredictionResult;
  combined: PredictionResult;
};

// Filter state used by the tracker table and dashboard.
export type MatchFilters = {
  competition: string;
  teamName: string;
  combined: 'all' | 'correct' | 'incorrect';
};

// Shared Opta metric shape for either attacking output or defensive allowances.
export type OptaMetricSet = {
  avgXg: number;
  goalsVsXg: number;
  avgShots: number;
  avgShotsOnTarget: number;
};

// A team's Opta profile keeps attacking and defending stats side by side.
export type OptaTeamStats = {
  id: string;
  team: string;
  attacking: OptaMetricSet;
  defending: OptaMetricSet;
};

// Prediction output generated from two Opta profiles by the blended model.
export type OptaMatchPrediction = {
  homeTeam: string;
  awayTeam: string;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  predictedTotalGoals: number;
  predictedTotalShots: number;
  predictedShotsOnTarget: number;
  predictedTotalGoalsLine: PredictionLine;
  predictedTotalShotsLine: PredictionLine;
  predictedShotsOnTargetLine: PredictionLine;
};
