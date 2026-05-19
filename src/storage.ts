import { sampleMatches } from './data/sampleMatches';
import { competitions, teamsByCompetition } from './data/competition';
import type { Match, OptaCompetitionStats, OptaStatsByCompetition, OptaTeamStats } from './types';

// LocalStorage keys are namespaced so match rows and Opta team profiles do not collide.
const STORAGE_KEY = 'football-prediction-tracker.matches';
const LEGACY_OPTA_STORAGE_KEY = 'football-prediction-tracker.opta-stats';
const OPTA_STORAGE_PREFIX = 'football-prediction-tracker.opta-stats-';

// Load tracker matches, falling back to sample data when localStorage is empty or corrupt.
export function loadMatches(): Match[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return sampleMatches;
  }

  try {
    return JSON.parse(raw) as Match[];
  } catch {
    return sampleMatches;
  }
}

// Save the current tracker table exactly as the app currently understands it.
export function saveMatches(matches: Match[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
}

// LocalStorage keys use the exact competition text so each dropdown option owns one browser slot.
function optaCompetitionStorageKey(competition: string): string {
  return `${OPTA_STORAGE_PREFIX}${competition}`;
}

// Validate the saved competition wrapper before trusting browser storage.
function readCompetitionStats(raw: string | null, fallbackCompetition: string): OptaCompetitionStats | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const item = parsed as Partial<OptaCompetitionStats>;
    if (!Array.isArray(item.teams)) {
      return null;
    }

    return {
      competition: typeof item.competition === 'string' && item.competition.trim()
        ? item.competition.trim()
        : fallbackCompetition,
      teams: item.teams as OptaTeamStats[],
    };
  } catch {
    return null;
  }
}

function normalizeTeamName(value: string): string {
  return value.trim().toLowerCase();
}

// Existing flat rows are assigned to the configured competition that owns that team name.
function competitionForTeam(team: string): string {
  const normalizedTeam = normalizeTeamName(team);

  for (const competition of competitions) {
    const teamNames = teamsByCompetition[competition as keyof typeof teamsByCompetition].map(normalizeTeamName);
    if (teamNames.includes(normalizedTeam)) {
      return competition;
    }
  }

  return competitions[0] ?? 'Opta model';
}

// Legacy single-array storage is migrated into the first matching competition by team names.
function loadLegacyOptaStats(): OptaStatsByCompetition {
  const raw = localStorage.getItem(LEGACY_OPTA_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return {};
    }

    return (parsed as OptaTeamStats[]).reduce<OptaStatsByCompetition>((current, team) => {
      const competition = competitionForTeam(team.team);
      current[competition] = {
        competition,
        teams: [...(current[competition]?.teams ?? []), team],
      };

      return current;
    }, {});
  } catch {
    return {};
  }
}

// Load each competition's isolated Opta JSON payload from browser storage.
export function loadOptaStats(): OptaStatsByCompetition {
  const loaded = competitions.reduce<OptaStatsByCompetition>((current, competition) => {
    const payload = readCompetitionStats(localStorage.getItem(optaCompetitionStorageKey(competition)), competition);
    if (payload) {
      current[payload.competition] = payload;
    }

    return current;
  }, {});

  if (Object.keys(loaded).length > 0) {
    return loaded;
  }

  // Keep old saved data available after the storage model changes.
  return loadLegacyOptaStats();
}

// Save each competition under football-prediction-tracker.opta-stats-{competition}.
export function saveOptaStats(statsByCompetition: OptaStatsByCompetition) {
  competitions.forEach((competition) => {
    const payload = statsByCompetition[competition];
    const key = optaCompetitionStorageKey(competition);
    if (!payload) {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, JSON.stringify(payload));
  });
}

export function formatOptaStatsStorageKey(competition: string): string {
  return optaCompetitionStorageKey(competition);
}
