export type PredictionDirection = 'over' | 'under';

export type PredictionLine = {
  direction: PredictionDirection;
  value: number;
};

export type PredictionResult = 'win' | 'loss' | 'pending' | 'not-selected';

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

export type MatchPredictionResults = {
  goals: PredictionResult;
  totalShots: PredictionResult;
  shotsOnTarget: PredictionResult;
  exactScoreline: PredictionResult;
  combined: PredictionResult;
};

export type MatchFilters = {
  competition: string;
  teamName: string;
  combined: 'all' | 'correct' | 'incorrect';
};
