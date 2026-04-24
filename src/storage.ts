import { sampleMatches } from './data/sampleMatches';
import type { Match } from './types';

const STORAGE_KEY = 'football-prediction-tracker.matches';

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

export function saveMatches(matches: Match[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
}
