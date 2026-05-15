import type { Match } from '../types';
import { calculateAccuracy } from '../utils/predictions';

type DashboardProps = {
  matches: Match[];
  competition: string;
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

export function Dashboard({ matches, competition }: DashboardProps) {
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

  return (
    <section className="dashboard-section" aria-label="Prediction dashboard">
      {/* Heading reflects the dashboard's current competition scope. */}
      <div className="dashboard-heading">
        <h2>{competition || 'All competitions'}</h2>
        <span>Accuracy stats</span>
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
