import { sampleMatches } from './data/sampleMatches';
import type { Match, OptaTeamStats } from './types';

// LocalStorage keys are namespaced so match rows and Opta team profiles do not collide.
const STORAGE_KEY = 'football-prediction-tracker.matches';
const OPTA_STORAGE_KEY = 'football-prediction-tracker.opta-stats';

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

// Load reusable Opta team stats for the second tab.
export function loadOptaStats(): OptaTeamStats[] {
  const raw = localStorage.getItem(OPTA_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OptaTeamStats[]) : [];
  } catch {
    return [];
  }
}

// Save Opta profiles independently so users can reuse one stat import for many fixtures.
export function saveOptaStats(stats: OptaTeamStats[]) {
  localStorage.setItem(OPTA_STORAGE_KEY, JSON.stringify(stats));
}
