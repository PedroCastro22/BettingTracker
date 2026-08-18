import { FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Match } from '../types';
import { calculateAccuracy } from '../utils/predictions';

type DashboardProps = {
  matches: Match[];
  competition: string;
  seasons: string[];
  models: string[];
  selectedSeason: string;
  selectedModel: string;
  databaseName: string;
  onSeasonChange: (season: string) => void;
  onModelChange: (model: string) => void;
  onAddSeason: (season: string) => void;
  onAddModel: (model: string) => void;
};

// Small reusable card for one dashboard metric.
function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

// Format accuracy as wins/settled predictions below the percentage.
function accuracyLabel(accuracy: ReturnType<typeof calculateAccuracy>) {
  return `${accuracy.wins}/${accuracy.total}`;
}

export function Dashboard({
  matches,
  competition,
  seasons,
  models,
  selectedSeason,
  selectedModel,
  databaseName,
  onSeasonChange,
  onModelChange,
  onAddSeason,
  onAddModel,
}: DashboardProps) {
  const [newSeason, setNewSeason] = useState('');
  const [newModel, setNewModel] = useState('');

  // Each card asks the shared accuracy helper for a different prediction category.
  const goals = calculateAccuracy(matches, (results) => results.goals);
  const shots = calculateAccuracy(matches, (results) => results.totalShots);
  const shotsOnTarget = calculateAccuracy(matches, (results) => results.shotsOnTarget);
  const exactScoreline = calculateAccuracy(matches, (results) => results.exactScoreline);
  const combined = calculateAccuracy(matches, (results) => results.combined);

  // Card data is built as an array so rendering stays compact and consistent.
  const cards = [
    { label: 'Matches', value: String(matches.length), detail: 'tracked locally' },
    { label: 'Goals', value: `${goals.percentage}%`, detail: accuracyLabel(goals) },
    { label: 'Shots', value: `${shots.percentage}%`, detail: accuracyLabel(shots) },
    { label: 'Shots on target', value: `${shotsOnTarget.percentage}%`, detail: accuracyLabel(shotsOnTarget) },
    { label: 'Exact score', value: `${exactScoreline.percentage}%`, detail: accuracyLabel(exactScoreline) },
    { label: 'Combined', value: `${combined.percentage}%`, detail: accuracyLabel(combined) },
  ];

  function addSeason(event: FormEvent) {
    event.preventDefault();
    const trimmed = newSeason.trim();
    if (!trimmed) {
      return;
    }

    onAddSeason(trimmed);
    setNewSeason('');
  }

  function addModel(event: FormEvent) {
    event.preventDefault();
    const trimmed = newModel.trim();
    if (!trimmed) {
      return;
    }

    onAddModel(trimmed);
    setNewModel('');
  }

  return (
    <section className="dashboard-section" aria-label="Prediction dashboard">
      {/* Controls define which isolated match database powers every tracker metric. */}
      <div className="dashboard-toolbar">
        <div>
          <div className="dashboard-heading">
            <h2>{competition || 'All competitions'}</h2>
            <span>Accuracy stats</span>
          </div>
          <p className="active-database">
            Viewing <strong>{selectedSeason}</strong> / <strong>{selectedModel}</strong>
            <code>{databaseName}</code>
          </p>
        </div>

        <div className="database-controls" aria-label="Prediction database selectors">
          <label>
            Season
            <select value={selectedSeason} onChange={(event) => onSeasonChange(event.target.value)}>
              {seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </label>

          <label>
            Model
            <select value={selectedModel} onChange={(event) => onModelChange(event.target.value)}>
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="database-add-grid">
        <form onSubmit={addSeason}>
          <label>
            Add season
            <span className="inline-add-control">
              <input value={newSeason} placeholder="26/27" onChange={(event) => setNewSeason(event.target.value)} />
              <button type="submit" className="icon-button" aria-label="Add season" title="Add season">
                <Plus size={18} />
              </button>
            </span>
          </label>
        </form>

        <form onSubmit={addModel}>
          <label>
            Add model
            <span className="inline-add-control">
              <input value={newModel} placeholder="Legacy Model" onChange={(event) => setNewModel(event.target.value)} />
              <button type="submit" className="icon-button" aria-label="Add model" title="Add model">
                <Plus size={18} />
              </button>
            </span>
          </label>
        </form>
      </div>

      {/* Render every prepared dashboard card with the same component. */}
      <div className="dashboard">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>
    </section>
  );
}
