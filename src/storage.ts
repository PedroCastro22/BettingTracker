import { sampleMatches } from './data/sampleMatches';
import { competitions, teamsByCompetition } from './data/competition';
import type {
  Match,
  OptaCompetitionStats,
  OptaStatsByCompetition,
  OptaTeamStats,
  PredictionDatabaseMetadata,
} from './types';

// LocalStorage keys are namespaced so match rows and Opta team profiles do not collide.
const STORAGE_KEY = 'football-prediction-tracker.matches';
const DATABASE_METADATA_KEY = 'football-prediction-tracker.database-metadata.json';
const LEGACY_DATABASE_MIGRATION_KEY = 'football-prediction-tracker.legacy-database-migration-v1';
const DATABASE_PREFIX = 'football-prediction-tracker.';
const LEGACY_OPTA_STORAGE_KEY = 'football-prediction-tracker.opta-stats';
const OPTA_STORAGE_PREFIX = 'football-prediction-tracker.opta-stats-';
export const DEFAULT_SEASON = '25/26';
export const DEFAULT_MODEL = 'Last 5 Matches';
export const LEGACY_MODEL = 'Legacy Model';
export const DEFAULT_DATABASE_METADATA: PredictionDatabaseMetadata = {
  seasons: [DEFAULT_SEASON],
  models: [DEFAULT_MODEL, LEGACY_MODEL],
};

function derivedTotal(first?: number, second?: number): number | undefined {
  return first === undefined || second === undefined ? undefined : first + second;
}

function normalizeMatch(match: Match): Match {
  return {
    ...match,
    actualTotalShots: derivedTotal(match.actualHomeShots, match.actualAwayShots) ?? match.actualTotalShots,
    actualShotsOnTarget:
      derivedTotal(match.actualHomeShotsOnTarget, match.actualAwayShotsOnTarget) ?? match.actualShotsOnTarget,
  };
}

function parseStoredMatches(raw: string | null): Match[] | null {
  if (!raw) {
    return null;
  }
  try {
    return (JSON.parse(raw) as Match[]).map(normalizeMatch);
  } catch {
    return null;
  }
}

function uniqueValues(values: string[]): string[] {
  return values.reduce<string[]>((current, value) => {
    const trimmed = value.trim();
    if (trimmed && !current.includes(trimmed)) {
      current.push(trimmed);
    }

    return current;
  }, []);
}

function normalizeMetadata(metadata: Partial<PredictionDatabaseMetadata>): PredictionDatabaseMetadata {
  return {
    seasons: uniqueValues([...(metadata.seasons ?? []), ...DEFAULT_DATABASE_METADATA.seasons]),
    models: uniqueValues([...(metadata.models ?? []), ...DEFAULT_DATABASE_METADATA.models]),
  };
}

function readMetadata(): PredictionDatabaseMetadata | null {
  const raw = localStorage.getItem(DATABASE_METADATA_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PredictionDatabaseMetadata>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return normalizeMetadata({
      seasons: Array.isArray(parsed.seasons) ? parsed.seasons.filter((item): item is string => typeof item === 'string') : [],
      models: Array.isArray(parsed.models) ? parsed.models.filter((item): item is string => typeof item === 'string') : [],
    });
  } catch {
    return null;
  }
}

function saveMetadata(metadata: PredictionDatabaseMetadata) {
  localStorage.setItem(DATABASE_METADATA_KEY, JSON.stringify(normalizeMetadata(metadata), null, 2));
}

function ensureMetadata(): PredictionDatabaseMetadata {
  const metadata = readMetadata() ?? DEFAULT_DATABASE_METADATA;
  saveMetadata(metadata);
  return metadata;
}

function addMetadataValue(field: keyof PredictionDatabaseMetadata, value: string): PredictionDatabaseMetadata {
  const trimmed = value.trim();
  const metadata = ensureMetadata();

  if (!trimmed || metadata[field].includes(trimmed)) {
    return metadata;
  }

  const next = {
    ...metadata,
    [field]: [...metadata[field], trimmed],
  };
  saveMetadata(next);
  return next;
}

function slugifyDatabasePart(value: string): string {
  const compact = value.trim().toLowerCase();
  if (compact === 'last 5 matches') {
    return 'last5';
  }

  if (compact === 'legacy model') {
    return 'legacy';
  }

  return compact
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default';
}

export function databaseFileName(season = DEFAULT_SEASON, model = DEFAULT_MODEL): string {
  return `season-${slugifyDatabasePart(season)}-${slugifyDatabasePart(model)}.json`;
}

function matchDatabaseStorageKey(season = DEFAULT_SEASON, model = DEFAULT_MODEL): string {
  return `${DATABASE_PREFIX}${databaseFileName(season, model)}`;
}

function isLegacyDefaultDatabase(season: string, model: string): boolean {
  return season === DEFAULT_SEASON && model === LEGACY_MODEL;
}

function writeMatchDatabase(season: string, model: string, matches: Match[]) {
  localStorage.setItem(matchDatabaseStorageKey(season, model), JSON.stringify(matches));
}

function migrateLegacyDatabase() {
  if (localStorage.getItem(LEGACY_DATABASE_MIGRATION_KEY) === 'done') {
    return;
  }

  const lastFiveKey = matchDatabaseStorageKey(DEFAULT_SEASON, DEFAULT_MODEL);
  const legacyKey = matchDatabaseStorageKey(DEFAULT_SEASON, LEGACY_MODEL);
  const lastFiveMatches = parseStoredMatches(localStorage.getItem(lastFiveKey));
  const legacyMatches = parseStoredMatches(localStorage.getItem(legacyKey));
  const oldMatches = parseStoredMatches(localStorage.getItem(STORAGE_KEY));
  const legacyNeedsData = !legacyMatches || legacyMatches.length === 0;

  if (legacyNeedsData) {
    const matchesForLegacy = oldMatches ?? lastFiveMatches ?? sampleMatches.map(normalizeMatch);
    localStorage.setItem(legacyKey, JSON.stringify(matchesForLegacy));

    if (lastFiveMatches && lastFiveMatches.length > 0) {
      localStorage.setItem(lastFiveKey, JSON.stringify([]));
    }
  }

  if (!lastFiveMatches) {
    localStorage.setItem(lastFiveKey, JSON.stringify([]));
  }

  localStorage.setItem(LEGACY_DATABASE_MIGRATION_KEY, 'done');
}

// Load tracker matches for the selected season/model database.
export function loadMatches(season = DEFAULT_SEASON, model = DEFAULT_MODEL): Match[] {
  migrateLegacyDatabase();
  const metadata = ensureMetadata();
  if (!metadata.seasons.includes(season)) {
    addMetadataValue('seasons', season);
  }
  if (!metadata.models.includes(model)) {
    addMetadataValue('models', model);
  }

  const storageKey = matchDatabaseStorageKey(season, model);
  const scopedMatches = parseStoredMatches(localStorage.getItem(storageKey));
  if (scopedMatches) {
    return scopedMatches;
  }

  if (isLegacyDefaultDatabase(season, model)) {
    const legacyMatches = parseStoredMatches(localStorage.getItem(STORAGE_KEY));
    const matches = legacyMatches ?? sampleMatches.map(normalizeMatch);
    writeMatchDatabase(season, model, matches);
    return matches;
  }

  return [];
}

// Save the current tracker table for the selected season/model database.
export function saveMatches(matches: Match[], season = DEFAULT_SEASON, model = DEFAULT_MODEL) {
  addMetadataValue('seasons', season);
  addMetadataValue('models', model);
  writeMatchDatabase(season, model, matches);
}

// Upsert one match into the selected season/model database.
export function saveMatch(match: Match, season = DEFAULT_SEASON, model = DEFAULT_MODEL): Match[] {
  const matches = loadMatches(season, model);
  const existing = matches.some((item) => item.id === match.id);
  const nextMatches = existing ? matches.map((item) => (item.id === match.id ? match : item)) : [match, ...matches];
  saveMatches(nextMatches, season, model);
  return nextMatches;
}

export function getAvailableSeasons(): string[] {
  return ensureMetadata().seasons;
}

export function getAvailableModels(): string[] {
  return ensureMetadata().models;
}

export function addAvailableSeason(season: string): string[] {
  return addMetadataValue('seasons', season).seasons;
}

export function addAvailableModel(model: string): string[] {
  return addMetadataValue('models', model).models;
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
