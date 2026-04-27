import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Braces } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Filters } from './components/Filters';
import { JsonMatchesEditor } from './components/JsonMatchesEditor';
import { MatchForm } from './components/MatchForm';
import { MatchTable } from './components/MatchTable';
import { loadMatches, saveMatches } from './storage';
import type { Match, MatchFilters } from './types';
import { calculateMatchResults } from './utils/predictions';

const defaultFilters: MatchFilters = {
  competition: '',
  teamName: '',
  combined: 'all',
};

export function App() {
  const [matches, setMatches] = useState<Match[]>(() => loadMatches());
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [filters, setFilters] = useState<MatchFilters>(defaultFilters);

  useEffect(() => {
    saveMatches(matches);
  }, [matches]);

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

  function handleSave(match: Match) {
    setMatches((current) => {
      const existing = current.some((item) => item.id === match.id);
      return existing ? current.map((item) => (item.id === match.id ? match : item)) : [match, ...current];
    });
    setEditingMatch(null);
  }

  function handleDelete(id: string) {
    setMatches((current) => current.filter((match) => match.id !== id));
    if (editingMatch?.id === id) {
      setEditingMatch(null);
    }
  }

  return (
    <main className="app-shell">
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

      <Dashboard matches={matches} />

      <div className="content-grid">
        <MatchForm editingMatch={editingMatch} onSave={handleSave} onCancelEdit={() => setEditingMatch(null)} />
        <div className="list-panel">
          <Filters filters={filters} matches={matches} onChange={setFilters} />
          <MatchTable matches={filteredMatches} onEdit={setEditingMatch} onDelete={handleDelete} />
        </div>
      </div>

      <JsonMatchesEditor
        matches={matches}
        open={jsonEditorOpen}
        onClose={() => setJsonEditorOpen(false)}
        onSave={(nextMatches) => {
          setMatches(nextMatches);
          setEditingMatch(null);
        }}
      />
    </main>
  );
}
