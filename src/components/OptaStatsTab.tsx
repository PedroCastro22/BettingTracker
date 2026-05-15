import { useMemo, useState } from 'react';
import { Braces, Calculator, Plus, Save, Trash2 } from 'lucide-react';
import type { Match, OptaMetricSet, OptaTeamStats } from '../types';
import { competitions } from '../data/competition';
import { calculateOptaMatchPrediction, formatLine } from '../utils/predictions';

type OptaStatsTabProps = {
  stats: OptaTeamStats[];
  matches: Match[];
  onChange: (stats: OptaTeamStats[]) => void;
  onAddMatch: (match: Match) => void;
};

// MetricKey lets table inputs update any numeric field in an Opta metric set.
type MetricKey = keyof OptaMetricSet;

// Shared column definition for both attacking and defending Opta tables.
const metricKeys: Array<{ key: MetricKey; label: string; step: string }> = [
  { key: 'avgXg', label: 'Avg XG', step: '0.01' },
  { key: 'goalsVsXg', label: 'Goals vs XG', step: '0.01' },
  { key: 'avgShots', label: 'Avg shots', step: '0.01' },
  { key: 'avgShotsOnTarget', label: 'Avg SOT / match', step: '0.01' },
];

// Starting values for a newly added team row.
const emptyMetrics: OptaMetricSet = {
  avgXg: 0,
  goalsVsXg: 0,
  avgShots: 0,
  avgShotsOnTarget: 0,
};

type RecentTeamAverages = {
  avgShots?: number;
  avgShotsOnTarget?: number;
};

// Example payload gives the JSON loader a visible template to edit or replace.
const exampleJson = `[
  {
    "team": "Barcelona",
    "attacking": { "avgXg": 2.34, "goalsVsXg": 0.19, "avgShots": 18.5, "avgShotsOnTarget": 6.78 },
    "defending": { "avgXg": 1.03, "goalsVsXg": -0.08, "avgShots": 10.7, "avgShotsOnTarget": 3.6 }
  }
]`;

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
  // First try exact keys for normal app-generated JSON.
  for (const key of keys) {
    if (source[key] !== undefined) {
      return toNumber(source[key]);
    }
  }

  // Then normalize keys so pasted exports with spaces, underscores, or casing still work.
  const normalizedEntries = Object.entries(source).map(([key, value]) => [
    key.replace(/[^a-z0-9]/gi, '').toLowerCase(),
    value,
  ]);

  // Match against the normalized list and return the first supported value.
  for (const key of keys) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const match = normalizedEntries.find(([entryKey]) => entryKey === normalizedKey);
    if (match) {
      return toNumber(match[1]);
    }
  }

  return 0;
}

// Read all four required Opta metrics from either nested or flat JSON data.
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

// Validate one pasted JSON object and convert it into the internal Opta team shape.
function normalizeStatsEntry(value: unknown, index: number): OptaTeamStats {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Entry ${index + 1} must be an object.`);
  }

  const item = value as Record<string, unknown>;
  const team = typeof item.team === 'string' ? item.team.trim() : '';

  if (!team) {
    throw new Error(`Entry ${index + 1} needs a team name.`);
  }

  // Prefer screenshot-style nested sections, but fall back to flat fields when pasted data is simpler.
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

  // Preserve an imported id when present, otherwise create one for React keys and selections.
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : crypto.randomUUID(),
    team,
    attacking: metricFromObject(attackingSource, attackingSource === item ? 'attacking' : ''),
    defending: metricFromObject(defendingSource, defendingSource === item ? 'defending' : ''),
  };
}

// Parse the JSON textarea into a full Opta stats table.
function parseOptaStatsJson(value: string): OptaTeamStats[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('JSON must be an array of team stat objects.');
  }

  return parsed.map(normalizeStatsEntry);
}

// Empty numeric fields display as blank instead of showing a wall of zeros in new rows.
function numberInputValue(value: number): string {
  return value === 0 ? '' : String(value);
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

function calculateRecentTeamAverages(matches: Match[], teamName: string): RecentTeamAverages {
  const normalizedTeam = normalizeTeamName(teamName);

  if (!normalizedTeam) {
    return {};
  }

  const teamMatches = matches
    .filter(
      (match) =>
        normalizeTeamName(match.homeTeam) === normalizedTeam ||
        normalizeTeamName(match.awayTeam) === normalizedTeam,
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const shots = teamMatches
    .map((match) => match.actualTotalShots)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
  const shotsOnTarget = teamMatches
    .map((match) => match.actualShotsOnTarget)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));

  return {
    avgShots: average(shots),
    avgShotsOnTarget: average(shotsOnTarget),
  };
}

export function OptaStatsTab({ stats, matches, onChange, onAddMatch }: OptaStatsTabProps) {
  // Local UI state controls the JSON input and the fixture currently being generated.
  const [jsonValue, setJsonValue] = useState(exampleJson);
  const [jsonError, setJsonError] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [competition, setCompetition] = useState('Opta model');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');

  // Keep dropdowns alphabetical without mutating the parent stats array.
  const sortedStats = useMemo(() => [...stats].sort((a, b) => a.team.localeCompare(b.team)), [stats]);
  const recentAverages = useMemo(() => {
    return Object.fromEntries(stats.map((team) => [team.id, calculateRecentTeamAverages(matches, team.team)]));
  }, [matches, stats]);
  const homeStats = stats.find((team) => team.id === homeTeamId);
  const awayStats = stats.find((team) => team.id === awayTeamId);

  // Prediction appears only when two different teams have complete row identities.
  const prediction = homeStats && awayStats && homeStats.id !== awayStats.id
    ? calculateOptaMatchPrediction(homeStats, awayStats)
    : null;

  // Update a team's name from the attacking table, where the editable name input lives.
  function updateTeam(id: string, team: string) {
    onChange(stats.map((item) => (item.id === id ? { ...item, team } : item)));
  }

  // Update one numeric metric inside either attacking or defending stats.
  function updateMetric(id: string, section: 'attacking' | 'defending', key: MetricKey, value: string) {
    onChange(
      stats.map((item) =>
        item.id === id
          ? {
              ...item,
              [section]: {
                ...item[section],
                [key]: toNumber(value),
              },
            }
          : item,
      ),
    );
  }

  // Add a blank team row with both attacking and defending metric sections.
  function addTeam() {
    const nextTeam: OptaTeamStats = {
      id: crypto.randomUUID(),
      team: '',
      attacking: { ...emptyMetrics },
      defending: { ...emptyMetrics },
    };

    onChange([...stats, nextTeam]);
  }

  // Remove a team and clear fixture selections that pointed at it.
  function removeTeam(id: string) {
    onChange(stats.filter((team) => team.id !== id));
    if (homeTeamId === id) {
      setHomeTeamId('');
    }
    if (awayTeamId === id) {
      setAwayTeamId('');
    }
  }

  // Replace the current table with parsed JSON, surfacing validation errors inline.
  function loadJson() {
    try {
      const nextStats = parseOptaStatsJson(jsonValue);
      onChange(nextStats);
      setJsonError('');
    } catch (caught) {
      setJsonError(caught instanceof Error ? caught.message : 'The Opta JSON could not be loaded.');
    }
  }

  // Convert the generated Opta prediction into a normal Match row for the tracker tab.
  function addPredictionToTracker() {
    if (!prediction) {
      return;
    }

    onAddMatch({
      id: crypto.randomUUID(),
      date,
      competition: competition.trim() || 'Opta model',
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      predictedHomeGoals: Math.round(prediction.predictedHomeGoals),
      predictedAwayGoals: Math.round(prediction.predictedAwayGoals),
      predictedTotalGoalsLine: prediction.predictedTotalGoalsLine,
      predictedTotalShotsLine: prediction.predictedTotalShotsLine,
      predictedShotsOnTargetLine: prediction.predictedShotsOnTargetLine,
      notes: `Opta blended model: ${prediction.predictedHomeGoals}-${prediction.predictedAwayGoals} xG, ${prediction.predictedTotalShots} shots, ${prediction.predictedShotsOnTarget} SoT.`,
    });
  }

  return (
    <section className="opta-tab">
      <div className="opta-layout">
        <div className="opta-main">
          {/* Toolbar anchors the stats-entry area and provides manual row creation. */}
          <div className="opta-toolbar">
            <div>
              <span className="eyebrow">
                <Calculator size={16} />
                Opta team stats
              </span>
              <h2>Stats input</h2>
            </div>
            <button type="button" className="secondary-button" onClick={addTeam}>
              <Plus size={18} />
              Add team
            </button>
          </div>

          {/* Attacking table matches the Opta screenshot's attacking stat layout. */}
          <StatsTable
            title="Attacking"
            caption="Per-match team attacking output"
            stats={stats}
            section="attacking"
            recentAverages={recentAverages}
            onUpdateTeam={updateTeam}
            onUpdateMetric={updateMetric}
            onRemove={removeTeam}
          />

          {/* Defending table mirrors the same columns, with values treated as against/faced. */}
          <StatsTable
            title="Defending"
            caption="All defensive stats are against/faced"
            stats={stats}
            section="defending"
            recentAverages={recentAverages}
            onUpdateTeam={updateTeam}
            onUpdateMetric={updateMetric}
            onRemove={removeTeam}
          />
        </div>

        <aside className="opta-side">
          {/* JSON loader lets users paste an export instead of typing every table cell. */}
          <section className="opta-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  <Braces size={16} />
                  JSON input
                </span>
                <h2>Load stats</h2>
              </div>
            </div>
            {/* Raw JSON input for bulk loading Opta team profiles. */}
            <textarea
              className="json-editor opta-json"
              spellCheck={false}
              value={jsonValue}
              onChange={(event) => {
                setJsonValue(event.target.value);
                setJsonError('');
              }}
            />
            {jsonError ? <p className="form-error">{jsonError}</p> : null}
            <button type="button" className="primary-button" onClick={loadJson}>
              <Save size={18} />
              Load JSON
            </button>
          </section>

          {/* Fixture generator turns two selected team profiles into prediction values. */}
          <section className="opta-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  <Calculator size={16} />
                  Blended model
                </span>
                <h2>Generate match</h2>
              </div>
            </div>

            {/* Fixture metadata and home/away team selection for the generated match. */}
            <div className="form-grid single-column">
              <label>
                Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label>
                Competition
                <input
                  list="opta-competitions"
                  value={competition}
                  onChange={(event) => setCompetition(event.target.value)}
                />
                <datalist id="opta-competitions">
                  {competitions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
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

            {/* Prediction output appears as soon as two different teams are selected. */}
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
              // Empty state explains why there is no generated prediction yet.
              <p className="empty-state">Select two different teams after loading stats to generate prediction values.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function StatsTable({
  title,
  caption,
  stats,
  section,
  recentAverages,
  onUpdateTeam,
  onUpdateMetric,
  onRemove,
}: {
  title: string;
  caption: string;
  stats: OptaTeamStats[];
  section: 'attacking' | 'defending';
  recentAverages: Record<string, RecentTeamAverages>;
  onUpdateTeam: (id: string, team: string) => void;
  onUpdateMetric: (id: string, section: 'attacking' | 'defending', key: MetricKey, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="opta-table-panel">
      {/* Section heading distinguishes attacking output from defensive allowances. */}
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <span>{caption}</span>
        </div>
      </div>

      {/* Shared table structure keeps attacking and defending sections visually aligned. */}
      <div className="table-wrap">
        <table className="opta-table">
          <colgroup>
            <col className="opta-team-col" />
            {metricKeys.map((metric) => (
              <col key={metric.key} className="opta-metric-col" />
            ))}
            <col className="opta-recent-col" />
            <col className="opta-recent-col" />
            <col className="opta-action-col" />
          </colgroup>
          <thead>
            <tr>
              <th>Team</th>
              {metricKeys.map((metric) => (
                <th key={metric.key}>{metric.label}</th>
              ))}
              <th>Avg shots last 5</th>
              <th>Avg SOT last 5</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Each team row exposes the same metric fields for the selected section. */}
            {stats.map((team) => (
              <tr key={team.id}>
                <td>
                  {/* Team name is edited once in the attacking table and shown read-only below. */}
                  {section === 'attacking' ? (
                    <input
                      aria-label="Team"
                      value={team.team}
                      onChange={(event) => onUpdateTeam(team.id, event.target.value)}
                      placeholder="Team name"
                    />
                  ) : (
                    <strong>{team.team || 'Unnamed team'}</strong>
                  )}
                </td>
                {metricKeys.map((metric) => (
                  <td key={metric.key}>
                    {/* Numeric inputs update either attacking or defending metrics in parent state. */}
                    <input
                      aria-label={`${team.team || 'Team'} ${title} ${metric.label}`}
                      type="number"
                      step={metric.step}
                      value={numberInputValue(team[section][metric.key])}
                      onChange={(event) => onUpdateMetric(team.id, section, metric.key, event.target.value)}
                    />
                  </td>
                ))}
                <td className="readonly-stat" title="Calculated from tracker entries involving this team">
                  {formatRecentAverage(recentAverages[team.id]?.avgShots)}
                </td>
                <td className="readonly-stat" title="Calculated from tracker entries involving this team">
                  {formatRecentAverage(recentAverages[team.id]?.avgShotsOnTarget)}
                </td>
                <td>
                  {/* Remove button is available in both sections because each row is one team profile. */}
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => onRemove(team.id)}
                    aria-label={`Remove ${team.team || 'team'}`}
                    title="Remove team"
                  >
                    <Trash2 size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {stats.length === 0 ? <p className="empty-state">Add a team or load a JSON stat export to begin.</p> : null}
      </div>
    </section>
  );
}
