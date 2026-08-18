import { useEffect, useMemo, useState } from 'react';
import { Braces, Calculator, Plus, Save } from 'lucide-react';
import type { Match, OptaCompetitionStats, OptaMetricSet, OptaStatsByCompetition, OptaTeamStats, PredictionLine } from '../types';
import { competitions } from '../data/competition';
import { calculateOptaMatchPrediction, formatLine } from '../utils/predictions';
import { formatOptaStatsStorageKey } from '../storage';

type RecentFormTabProps = {
  statsByCompetition: OptaStatsByCompetition;
  matches: Match[];
  onChange: (statsByCompetition: OptaStatsByCompetition) => void;
  onAddMatch: (match: Match) => void;
};

type RecentTeamAverages = {
  avgShots?: number;
  avgShotsOnTarget?: number;
  validMatchCount: number;
};

type RecentFormMode = 'attacking' | 'defending';

// Example payload gives the JSON loader a visible season-average fallback template.
const exampleJson = `{
  "competition": "La Liga",
  "teams": [
    {
      "team": "Barcelona",
      "attacking": { "avgXg": 2.34, "goalsVsXg": 0.19, "avgShots": 18.5, "avgShotsOnTarget": 6.78 },
      "defending": { "avgXg": 1.03, "goalsVsXg": -0.08, "avgShots": 10.7, "avgShotsOnTarget": 3.6 }
    }
  ]
}`;

// Convert flexible pasted values into numbers while treating invalid values as zero.
function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  return fallback;
}

// Find a numeric value from several accepted key names, including snake-case variants.
function readFirstNumber(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    if (source[key] !== undefined) {
      return toNumber(source[key]);
    }
  }

  const normalizedEntries = Object.entries(source).map(([key, value]) => [
    key.replace(/[^a-z0-9]/gi, '').toLowerCase(),
    value,
  ]);

  for (const key of keys) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const match = normalizedEntries.find(([entryKey]) => entryKey === normalizedKey);
    if (match) {
      return toNumber(match[1]);
    }
  }

  return 0;
}

// Read required season-average metrics from either nested or flat JSON data.
function metricFromObject(source: Record<string, unknown>, prefix = ''): OptaMetricSet {
  const titlePrefix = prefix ? prefix[0].toUpperCase() + prefix.slice(1) : '';

  return {
    avgXg: readFirstNumber(source, [`${prefix}AvgXg`, `${prefix}Xg`, `${titlePrefix}AvgXg`, `${titlePrefix}Xg`, 'avgXg', 'xg']),
    goalsVsXg: readFirstNumber(source, [
      `${prefix}GoalsVsXg`,
      `${titlePrefix}GoalsVsXg`,
      'goalsVsXg',
      'goals_vs_xg',
    ]),
    avgShots: readFirstNumber(source, [
      `${prefix}AvgShots`,
      `${prefix}Shots`,
      `${prefix}ShotsPerMatch`,
      `${titlePrefix}AvgShots`,
      `${titlePrefix}Shots`,
      `${titlePrefix}ShotsPerMatch`,
      'avgShots',
      'avgShotsPerMatch',
      'shots',
      'shotsPerMatch',
    ]),
    avgShotsOnTarget: readFirstNumber(source, [
      `${prefix}AvgShotsOnTarget`,
      `${prefix}AvgSot`,
      `${prefix}Sot`,
      `${prefix}SotPerMatch`,
      `${titlePrefix}AvgShotsOnTarget`,
      `${titlePrefix}AvgSot`,
      `${titlePrefix}Sot`,
      `${titlePrefix}SotPerMatch`,
      'avgShotsOnTarget',
      'avgSot',
      'sot',
      'sotPerMatch',
    ]),
  };
}

// Validate one pasted JSON object and convert it into the internal season-average team shape.
function normalizeStatsEntry(value: unknown, index: number): OptaTeamStats {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Entry ${index + 1} must be an object.`);
  }

  const item = value as Record<string, unknown>;
  const team = typeof item.team === 'string' ? item.team.trim() : '';

  if (!team) {
    throw new Error(`Entry ${index + 1} needs a team name.`);
  }

  const attackingSource =
    item.attacking && typeof item.attacking === 'object' && !Array.isArray(item.attacking)
      ? (item.attacking as Record<string, unknown>)
      : item;
  const defendingSource =
    item.defending && typeof item.defending === 'object' && !Array.isArray(item.defending)
      ? (item.defending as Record<string, unknown>)
      : item.defense && typeof item.defense === 'object' && !Array.isArray(item.defense)
        ? (item.defense as Record<string, unknown>)
        : item;

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : crypto.randomUUID(),
    team,
    attacking: metricFromObject(attackingSource, attackingSource === item ? 'attacking' : ''),
    defending: metricFromObject(defendingSource, defendingSource === item ? 'defending' : ''),
  };
}

// Parse the JSON textarea into one competition-scoped season-average payload.
function parseRecentFormJson(value: string): OptaCompetitionStats {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON must be an object with competition and teams fields.');
  }

  const item = parsed as Record<string, unknown>;
  const competition = typeof item.competition === 'string' ? item.competition.trim() : '';

  if (!competition) {
    throw new Error('JSON needs a competition field.');
  }

  if (!Array.isArray(item.teams)) {
    throw new Error('JSON needs a teams array.');
  }

  return {
    competition,
    teams: item.teams.map(normalizeStatsEntry),
  };
}

function formatCompetitionStatsJson(payload: OptaCompetitionStats): string {
  return JSON.stringify(payload, null, 2);
}

function normalizeTeamName(value: string): string {
  return value.trim().toLowerCase();
}

function average(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function formatRecentAverage(value?: number): string {
  if (value === undefined) {
    return '-';
  }

  return String(value).replace(/\.?0+$/, '');
}

function teamStatsForMatch(
  match: Match,
  teamName: string,
  mode: RecentFormMode,
): { shots?: number; shotsOnTarget?: number } | null {
  const normalizedTeam = normalizeTeamName(teamName);

  if (normalizeTeamName(match.homeTeam) === normalizedTeam) {
    return {
      shots: mode === 'attacking' ? match.actualHomeShots : match.actualAwayShots,
      shotsOnTarget: mode === 'attacking' ? match.actualHomeShotsOnTarget : match.actualAwayShotsOnTarget,
    };
  }

  if (normalizeTeamName(match.awayTeam) === normalizedTeam) {
    return {
      shots: mode === 'attacking' ? match.actualAwayShots : match.actualHomeShots,
      shotsOnTarget: mode === 'attacking' ? match.actualAwayShotsOnTarget : match.actualHomeShotsOnTarget,
    };
  }

  return null;
}

function isValidRecentStat(stat: { shots?: number; shotsOnTarget?: number } | null): stat is { shots: number; shotsOnTarget: number } {
  return (
    !!stat &&
    typeof stat.shots === 'number' &&
    typeof stat.shotsOnTarget === 'number' &&
    !Number.isNaN(stat.shots) &&
    !Number.isNaN(stat.shotsOnTarget) &&
    stat.shotsOnTarget <= stat.shots
  );
}

function calculateRecentTeamAverages(matches: Match[], teamName: string, mode: RecentFormMode): RecentTeamAverages {
  const normalizedTeam = normalizeTeamName(teamName);

  if (!normalizedTeam) {
    return { validMatchCount: 0 };
  }

  const recentStats = matches
    .filter(
      (match) =>
        normalizeTeamName(match.homeTeam) === normalizedTeam ||
        normalizeTeamName(match.awayTeam) === normalizedTeam,
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((match) => teamStatsForMatch(match, teamName, mode))
    .filter(isValidRecentStat)
    .slice(0, 5);

  return {
    avgShots: average(recentStats.map((stat) => stat.shots)),
    avgShotsOnTarget: average(recentStats.map((stat) => stat.shotsOnTarget)),
    validMatchCount: recentStats.length,
  };
}

function effectiveAverages(team: OptaTeamStats, recent: RecentTeamAverages, mode: RecentFormMode): RecentTeamAverages {
  if (recent.validMatchCount >= 5) {
    return recent;
  }

  const fallback = mode === 'attacking' ? team.attacking : team.defending;

  return {
    avgShots: fallback.avgShots,
    avgShotsOnTarget: fallback.avgShotsOnTarget,
    validMatchCount: recent.validMatchCount,
  };
}

function weightedExpectedVolume(
  recentAttackingValue: number,
  opponentRecentDefendingValue: number,
  seasonAttackingValue: number,
): number {
  return recentAttackingValue * 0.5 + opponentRecentDefendingValue * 0.3 + seasonAttackingValue * 0.2;
}

function calculateWeightedShotProjection({
  homeStats,
  awayStats,
  homeAttackingRecent,
  awayAttackingRecent,
  homeDefendingRecent,
  awayDefendingRecent,
}: {
  homeStats: OptaTeamStats;
  awayStats: OptaTeamStats;
  homeAttackingRecent: RecentTeamAverages;
  awayAttackingRecent: RecentTeamAverages;
  homeDefendingRecent: RecentTeamAverages;
  awayDefendingRecent: RecentTeamAverages;
}): { predictedTotalShots: number; predictedShotsOnTarget: number } | null {
  if (
    homeAttackingRecent.avgShots === undefined ||
    awayAttackingRecent.avgShots === undefined ||
    homeDefendingRecent.avgShots === undefined ||
    awayDefendingRecent.avgShots === undefined ||
    homeAttackingRecent.avgShotsOnTarget === undefined ||
    awayAttackingRecent.avgShotsOnTarget === undefined ||
    homeDefendingRecent.avgShotsOnTarget === undefined ||
    awayDefendingRecent.avgShotsOnTarget === undefined
  ) {
    return null;
  }

  const homeExpectedShots = weightedExpectedVolume(
    homeAttackingRecent.avgShots,
    awayDefendingRecent.avgShots,
    homeStats.attacking.avgShots,
  );
  const awayExpectedShots = weightedExpectedVolume(
    awayAttackingRecent.avgShots,
    homeDefendingRecent.avgShots,
    awayStats.attacking.avgShots,
  );
  const homeExpectedShotsOnTarget = weightedExpectedVolume(
    homeAttackingRecent.avgShotsOnTarget,
    awayDefendingRecent.avgShotsOnTarget,
    homeStats.attacking.avgShotsOnTarget,
  );
  const awayExpectedShotsOnTarget = weightedExpectedVolume(
    awayAttackingRecent.avgShotsOnTarget,
    homeDefendingRecent.avgShotsOnTarget,
    awayStats.attacking.avgShotsOnTarget,
  );

  return {
    predictedTotalShots: Math.round(homeExpectedShots + awayExpectedShots),
    predictedShotsOnTarget: Math.round(homeExpectedShotsOnTarget + awayExpectedShotsOnTarget),
  };
}

function suggestedHalfLine(projection: number): PredictionLine {
  const value = Math.max(0.5, Math.floor(projection) + 0.5);

  return {
    direction: projection > value ? 'over' : 'under',
    value,
  };
}

export function RecentFormTab({ statsByCompetition, matches, onChange, onAddMatch }: RecentFormTabProps) {
  // Local UI state controls the JSON input and the fixture currently being generated.
  const [jsonValue, setJsonValue] = useState(exampleJson);
  const [jsonError, setJsonError] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [competition, setCompetition] = useState(competitions[0] ?? '');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [recentFormMode, setRecentFormMode] = useState<RecentFormMode>('attacking');

  // Each competition tab reads only its own saved JSON payload.
  const currentPayload = useMemo(
    () => statsByCompetition[competition] ?? { competition, teams: [] },
    [competition, statsByCompetition],
  );
  const stats = currentPayload.teams;
  const competitionMatches = useMemo(() => {
    return competition ? matches.filter((match) => match.competition === competition) : matches;
  }, [competition, matches]);
  const sortedStats = useMemo(() => [...stats].sort((a, b) => a.team.localeCompare(b.team)), [stats]);
  const attackingRecentAverages = useMemo(() => {
    return Object.fromEntries(
      stats.map((team) => {
        const recent = calculateRecentTeamAverages(competitionMatches, team.team, 'attacking');
        return [team.id, effectiveAverages(team, recent, 'attacking')];
      }),
    );
  }, [competitionMatches, stats]);
  const defendingRecentAverages = useMemo(() => {
    return Object.fromEntries(
      stats.map((team) => {
        const recent = calculateRecentTeamAverages(competitionMatches, team.team, 'defending');
        return [team.id, effectiveAverages(team, recent, 'defending')];
      }),
    );
  }, [competitionMatches, stats]);
  const recentAverages = recentFormMode === 'attacking' ? attackingRecentAverages : defendingRecentAverages;
  const homeStats = stats.find((team) => team.id === homeTeamId);
  const awayStats = stats.find((team) => team.id === awayTeamId);
  const homeAttackingRecent = homeStats ? attackingRecentAverages[homeStats.id] : undefined;
  const awayAttackingRecent = awayStats ? attackingRecentAverages[awayStats.id] : undefined;
  const homeDefendingRecent = homeStats ? defendingRecentAverages[homeStats.id] : undefined;
  const awayDefendingRecent = awayStats ? defendingRecentAverages[awayStats.id] : undefined;

  // Goals stay on the existing model; shot volumes now come from recent form or season fallback.
  const prediction =
    homeStats &&
    awayStats &&
    homeStats.id !== awayStats.id &&
    homeAttackingRecent &&
    awayAttackingRecent &&
    homeDefendingRecent &&
    awayDefendingRecent
      ? (() => {
          const basePrediction = calculateOptaMatchPrediction(homeStats, awayStats);
          const shotProjection = calculateWeightedShotProjection({
            homeStats,
            awayStats,
            homeAttackingRecent,
            awayAttackingRecent,
            homeDefendingRecent,
            awayDefendingRecent,
          });

          if (!shotProjection) {
            return null;
          }

          const { predictedTotalShots, predictedShotsOnTarget } = shotProjection;

          return {
            ...basePrediction,
            predictedTotalShots,
            predictedShotsOnTarget,
            predictedTotalShotsLine: suggestedHalfLine(predictedTotalShots),
            predictedShotsOnTargetLine: suggestedHalfLine(predictedShotsOnTarget),
          };
        })()
      : null;

  useEffect(() => {
    // When the competition changes, show the JSON saved for that exact competition key.
    setJsonValue(formatCompetitionStatsJson(currentPayload));
    setJsonError('');
  }, [competition, currentPayload]);

  function updateCompetition(competition: string) {
    setCompetition(competition);
    setHomeTeamId('');
    setAwayTeamId('');
  }

  // Replace the current fallback payload with parsed JSON, surfacing validation errors inline.
  function loadJson() {
    try {
      const payload = parseRecentFormJson(jsonValue);
      if (!competitions.includes(payload.competition)) {
        throw new Error(`Competition must match one of: ${competitions.join(', ')}.`);
      }

      onChange({
        ...statsByCompetition,
        [payload.competition]: payload,
      });
      setCompetition(payload.competition);
      setHomeTeamId('');
      setAwayTeamId('');
      setJsonError('');
    } catch (caught) {
      setJsonError(caught instanceof Error ? caught.message : 'The recent form JSON could not be loaded.');
    }
  }

  // Convert the generated recent-form prediction into a normal Match row for the tracker tab.
  function addPredictionToTracker() {
    if (!prediction) {
      return;
    }

    onAddMatch({
      id: crypto.randomUUID(),
      date,
      competition: competition.trim() || 'Recent form',
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      predictedHomeGoals: Math.round(prediction.predictedHomeGoals),
      predictedAwayGoals: Math.round(prediction.predictedAwayGoals),
      predictedTotalGoalsLine: prediction.predictedTotalGoalsLine,
      predictedTotalShotsLine: prediction.predictedTotalShotsLine,
      predictedShotsOnTargetLine: prediction.predictedShotsOnTargetLine,
      notes: `Recent form model: ${prediction.predictedHomeGoals}-${prediction.predictedAwayGoals} goals, ${prediction.predictedTotalShots} shots, ${prediction.predictedShotsOnTarget} SoT.`,
    });
  }

  return (
    <section className="opta-tab">
      <div className="opta-layout">
        <div className="opta-main">
          <div className="opta-toolbar">
            <div>
              <span className="eyebrow">
                <Calculator size={16} />
                Recent form
              </span>
              <h2>Team averages</h2>
            </div>
            <div className="opta-controls">
              <label>
                Competition
                <select value={competition} onChange={(event) => updateCompetition(event.target.value)}>
                  {competitions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <RecentFormTable
            stats={sortedStats}
            recentAverages={recentAverages}
            mode={recentFormMode}
            onModeChange={setRecentFormMode}
          />
        </div>

        <aside className="opta-side">
          <section className="opta-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  <Braces size={16} />
                  JSON input
                </span>
                <h2>Load season averages</h2>
              </div>
            </div>
            <textarea
              className="json-editor opta-json"
              spellCheck={false}
              value={jsonValue}
              onChange={(event) => {
                setJsonValue(event.target.value);
                setJsonError('');
              }}
            />
            <p className="storage-key">
              Saved under <code>{formatOptaStatsStorageKey(competition)}</code>
            </p>
            {jsonError ? <p className="form-error">{jsonError}</p> : null}
            <button type="button" className="primary-button" onClick={loadJson}>
              <Save size={18} />
              Load JSON
            </button>
          </section>

          <section className="opta-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  <Calculator size={16} />
                  Recent form model
                </span>
                <h2>Generate match</h2>
              </div>
            </div>

            <div className="form-grid single-column">
              <label>
                Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label>
                Competition
                <select value={competition} onChange={(event) => updateCompetition(event.target.value)}>
                  {competitions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Home team
                <select value={homeTeamId} onChange={(event) => setHomeTeamId(event.target.value)}>
                  <option value="">Select home team</option>
                  {sortedStats.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team || 'Unnamed team'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Away team
                <select value={awayTeamId} onChange={(event) => setAwayTeamId(event.target.value)}>
                  <option value="">Select away team</option>
                  {sortedStats.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team || 'Unnamed team'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {prediction ? (
              <>
                <div className="prediction-output">
                  <div>
                    <span>Projected score</span>
                    <strong>
                      {prediction.predictedHomeGoals} - {prediction.predictedAwayGoals}
                    </strong>
                  </div>
                  <div>
                    <span>Total goals</span>
                    <strong>{prediction.predictedTotalGoals}</strong>
                    <small>{formatLine(prediction.predictedTotalGoalsLine)}</small>
                  </div>
                  <div>
                    <span>Total shots</span>
                    <strong>{prediction.predictedTotalShots}</strong>
                    <small>{formatLine(prediction.predictedTotalShotsLine)}</small>
                  </div>
                  <div>
                    <span>Shots on target</span>
                    <strong>{prediction.predictedShotsOnTarget}</strong>
                    <small>{formatLine(prediction.predictedShotsOnTargetLine)}</small>
                  </div>
                </div>
                <button type="button" className="primary-button" onClick={addPredictionToTracker}>
                  <Plus size={18} />
                  Add to tracker
                </button>
              </>
            ) : (
              <p className="empty-state">Select two different teams after loading season averages to generate prediction values.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function RecentFormTable({
  stats,
  recentAverages,
  mode,
  onModeChange,
}: {
  stats: OptaTeamStats[];
  recentAverages: Record<string, RecentTeamAverages>;
  mode: RecentFormMode;
  onModeChange: (mode: RecentFormMode) => void;
}) {
  const isDefending = mode === 'defending';

  return (
    <section className="opta-table-panel">
      <div className="section-heading">
        <div>
          <h2>Recent form</h2>
          <span>
            {isDefending ? 'Shots allowed' : 'Shots taken'} from the last five tracker matches, with season averages
            until five valid matches are saved.
          </span>
        </div>
        <div className="mode-toggle recent-form-toggle" aria-label="Recent form stat type">
          <button
            type="button"
            className={mode === 'attacking' ? 'active' : ''}
            onClick={() => onModeChange('attacking')}
          >
            Attacking
          </button>
          <button
            type="button"
            className={mode === 'defending' ? 'active' : ''}
            onClick={() => onModeChange('defending')}
          >
            Defending
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="opta-table recent-form-table">
          <colgroup>
            <col className="opta-team-col" />
            <col className="opta-recent-col" />
            <col className="opta-recent-col" />
          </colgroup>
          <thead>
            <tr>
              <th>Team</th>
              <th>Last 5 match avg {isDefending ? 'shots allowed' : 'shots'}</th>
              <th>Last 5 match avg {isDefending ? 'SOT allowed' : 'SOT'}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((team) => (
              <tr key={team.id}>
                <td>
                  <strong>{team.team || 'Unnamed team'}</strong>
                </td>
                <td className="readonly-stat" title="Uses season average until five valid team-level tracker matches are saved">
                  {formatRecentAverage(recentAverages[team.id]?.avgShots)}
                </td>
                <td className="readonly-stat" title="Uses season average until five valid team-level tracker matches are saved">
                  {formatRecentAverage(recentAverages[team.id]?.avgShotsOnTarget)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {stats.length === 0 ? <p className="empty-state">No season averages match the selected competition.</p> : null}
      </div>
    </section>
  );
}
