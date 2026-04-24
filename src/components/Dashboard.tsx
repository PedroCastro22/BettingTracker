import type { Match } from '../types';
import { calculateAccuracy } from '../utils/predictions';

type DashboardProps = {
  matches: Match[];
};

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function accuracyLabel(accuracy: ReturnType<typeof calculateAccuracy>) {
  return `${accuracy.wins}/${accuracy.total}`;
}

export function Dashboard({ matches }: DashboardProps) {
  const goals = calculateAccuracy(matches, (results) => results.goals);
  const shots = calculateAccuracy(matches, (results) => results.totalShots);
  const shotsOnTarget = calculateAccuracy(matches, (results) => results.shotsOnTarget);
  const exactScoreline = calculateAccuracy(matches, (results) => results.exactScoreline);
  const combined = calculateAccuracy(matches, (results) => results.combined);

  const cards = [
    { label: 'Matches', value: String(matches.length), detail: 'tracked locally' },
    { label: 'Goals', value: `${goals.percentage}%`, detail: accuracyLabel(goals) },
    { label: 'Shots', value: `${shots.percentage}%`, detail: accuracyLabel(shots) },
    { label: 'Shots on target', value: `${shotsOnTarget.percentage}%`, detail: accuracyLabel(shotsOnTarget) },
    { label: 'Exact score', value: `${exactScoreline.percentage}%`, detail: accuracyLabel(exactScoreline) },
    { label: 'Combined', value: `${combined.percentage}%`, detail: accuracyLabel(combined) },
  ];

  return (
    <section className="dashboard" aria-label="Prediction dashboard">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </section>
  );
}
