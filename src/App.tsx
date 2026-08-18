import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Braces } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Filters } from './components/Filters';
import { JsonMatchesEditor } from './components/JsonMatchesEditor';
import { MatchForm } from './components/MatchForm';
import { MatchTable } from './components/MatchTable';
import { RecentFormTab } from './components/RecentFormTab';
import {
  DEFAULT_MODEL,
  DEFAULT_SEASON,
  addAvailableModel,
  addAvailableSeason,
  databaseFileName,
  getAvailableModels,
  getAvailableSeasons,
  loadMatches,
  loadOptaStats,
  saveMatches,
  saveOptaStats,
} from './storage';
import type { Match, MatchFilters, OptaStatsByCompetition } from './types';
import { calculateMatchResults } from './utils/predictions';

// Default filter state for the match tracker tab.
const defaultFilters: MatchFilters = {
  competition: '',
  teamName: '',
  combined: 'all',
};

export function App() {
  // Top-level app state is kept here so both tabs can read or update saved predictions.
  const [availableSeasons, setAvailableSeasons] = useState<string[]>(() => getAvailableSeasons());
  const [availableModels, setAvailableModels] = useState<string[]>(() => getAvailableModels());
  const [selectedSeason, setSelectedSeason] = useState(DEFAULT_SEASON);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [matches, setMatches] = useState<Match[]>(() => loadMatches(DEFAULT_SEASON, DEFAULT_MODEL));
  const [optaStats, setOptaStats] = useState<OptaStatsByCompetition>(() => loadOptaStats());
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [filters, setFilters] = useState<MatchFilters>(defaultFilters);
  const [activeTab, setActiveTab] = useState<'tracker' | 'opta'>('tracker');

  // Changing season or model swaps the whole match table to that isolated JSON database.
  useEffect(() => {
    setMatches(loadMatches(selectedSeason, selectedModel));
    setEditingMatch(null);
    setFilters(defaultFilters);
  }, [selectedSeason, selectedModel]);

  // Persist match tracker rows whenever the user adds, edits, deletes, or imports matches.
  useEffect(() => {
    saveMatches(matches, selectedSeason, selectedModel);
  }, [matches]);

  // Persist Opta team stat profiles separately from the match tracker rows.
  useEffect(() => {
    saveOptaStats(optaStats);
  }, [optaStats]);

  // Dashboard cards only use the selected competition filter, not the team or result filters.
  const filteredDashboard = useMemo(() => {
    if (!filters.competition) {
      return matches;
    }

    return matches.filter((match) => match.competition === filters.competition);
  }, [matches, filters.competition]);

  // Match table rows apply every selected filter, then show newest fixtures first.
  const filteredMatches = useMemo(() => {
    return matches
      .filter((match) => {
        const competitionMatch = !filters.competition || match.competition === filters.competition;
        const teamQuery = filters.teamName.trim().toLowerCase();
        const teamMatch =
          !teamQuery ||
          match.homeTeam.toLowerCase().includes(teamQuery) ||
          match.awayTeam.toLowerCase().includes(teamQuery);
        const combined = calculateMatchResults(match).combined;
        const combinedMatch =
          filters.combined === 'all' ||
          (filters.combined === 'correct' && combined === 'win') ||
          (filters.combined === 'incorrect' && combined === 'loss');

        return competitionMatch && teamMatch && combinedMatch;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [matches, filters]);

  // Shared save handler supports both manual form saves and Opta-generated predictions.
  function handleSave(match: Match) {
    setMatches((current) => {
      const existing = current.some((item) => item.id === match.id);
      return existing ? current.map((item) => (item.id === match.id ? match : item)) : [match, ...current];
    });
    setEditingMatch(null);
  }

  // Removing a match also clears the edit form if that same match was being edited.
  function handleDelete(id: string) {
    setMatches((current) => current.filter((match) => match.id !== id));
    if (editingMatch?.id === id) {
      setEditingMatch(null);
    }
  }

  function handleAddSeason(season: string) {
    const trimmed = season.trim();
    if (!trimmed) {
      return;
    }

    setAvailableSeasons(addAvailableSeason(trimmed));
    setSelectedSeason(trimmed);
  }

  function handleAddModel(model: string) {
    const trimmed = model.trim();
    if (!trimmed) {
      return;
    }

    setAvailableModels(addAvailableModel(trimmed));
    setSelectedModel(trimmed);
  }

  const currentDatabaseName = databaseFileName(selectedSeason, selectedModel);

  return (
    <main className="app-shell">
      {/* App header keeps the global JSON editor available regardless of active tab. */}
      <header className="app-header">
        <div>
          <span className="eyebrow">
            <BarChart3 size={16} />
            Local tracker
          </span>
          <h1>Football Prediction Tracker</h1>
          <p>Compare your pre-match lines against final goals, shots, and shots on target.</p>
        </div>
        <button type="button" className="secondary-button header-action" onClick={() => setJsonEditorOpen(true)}>
          <Braces size={18} />
          Edit JSON
        </button>
      </header>

      {/* Two-tab navigation preserves the original tracker while adding the Opta workflow. */}
      <nav className="tabs" aria-label="App views">
        <button
          type="button"
          className={activeTab === 'tracker' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('tracker')}
        >
          Match Tracker
        </button>
        <button
          type="button"
          className={activeTab === 'opta' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('opta')}
        >
          Recent Form
        </button>
      </nav>

      {/* Tracker tab is the original dashboard, form, filters, and results table. */}
      {activeTab === 'tracker' ? (
        <>
          <Dashboard
            matches={filteredDashboard}
            competition={filters.competition}
            seasons={availableSeasons}
            models={availableModels}
            selectedSeason={selectedSeason}
            selectedModel={selectedModel}
            databaseName={currentDatabaseName}
            onSeasonChange={setSelectedSeason}
            onModelChange={setSelectedModel}
            onAddSeason={handleAddSeason}
            onAddModel={handleAddModel}
          />

          <div className="content-grid">
            <MatchForm editingMatch={editingMatch} onSave={handleSave} onCancelEdit={() => setEditingMatch(null)} />
            <div className="list-panel">
              <Filters filters={filters} matches={matches} onChange={setFilters} />
              <MatchTable matches={filteredMatches} onEdit={setEditingMatch} onDelete={handleDelete} />
            </div>
          </div>
        </>
      ) : (
        // Recent form tab stores season-average fallbacks and can add generated matches to the tracker.
        <div className="tab-panel">
          <RecentFormTab statsByCompetition={optaStats} matches={matches} onChange={setOptaStats} onAddMatch={handleSave} />
        </div>
      )}

      {/* Modal editor lets advanced users import/export all tracked matches as JSON. */}
      <JsonMatchesEditor
        matches={matches}
        open={jsonEditorOpen}
        season={selectedSeason}
        model={selectedModel}
        databaseName={currentDatabaseName}
        onClose={() => setJsonEditorOpen(false)}
        onSave={(nextMatches) => {
          setMatches(nextMatches);
          setEditingMatch(null);
        }}
      />
    </main>
  );
}
