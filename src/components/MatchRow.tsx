import { Edit2, Trash2 } from 'lucide-react';
import type { Match, PredictionResult } from '../types';
import { calculateMatchResults, formatLine } from '../utils/predictions';

type MatchRowProps = {
  match: Match;
  onEdit: (match: Match) => void;
  onDelete: (id: string) => void;
};

// Badge converts calculation states into short, styled table labels.
function ResultBadge({ result }: { result: PredictionResult }) {
  const label = {
    win: 'Win',
    loss: 'Loss',
    pending: 'Pending',
    'not-selected': '-',
  }[result];

  return <span className={`result-badge ${result}`}>{label}</span>;
}

export function MatchRow({ match, onEdit, onDelete }: MatchRowProps) {
  // Calculate all prediction outcomes before rendering the row badges.
  const results = calculateMatchResults(match);

  // Actual score is blank until both final goals have been entered.
  const actualScore =
    match.actualHomeGoals === undefined || match.actualAwayGoals === undefined
      ? '-'
      : `${match.actualHomeGoals}-${match.actualAwayGoals}`;

  return (
    <tr>
      {/* Match cell combines fixture identity, date, and competition. */}
      <td>
        <strong>{match.homeTeam}</strong>
        <span className="muted"> vs {match.awayTeam}</span>
        <small>{match.date} · {match.competition}</small>
      </td>
      <td>{match.predictedHomeGoals}-{match.predictedAwayGoals}</td>
      <td>{actualScore}</td>
      {/* Each stat line shows the prediction and the calculated result badge. */}
      <td>
        <span className="prediction-line">{formatLine(match.predictedTotalGoalsLine)}</span>
        <br />
        <ResultBadge result={results.goals} />
      </td>
      <td>
        <span className="prediction-line">{formatLine(match.predictedTotalShotsLine)}</span>
        <small className="muted"> Actual: {match.actualTotalShots}</small>
        <ResultBadge result={results.totalShots} />
      </td>
      <td>
        <span className="prediction-line">{formatLine(match.predictedShotsOnTargetLine)}</span>
        <small className="muted"> Actual: {match.actualShotsOnTarget}</small>
        <ResultBadge result={results.shotsOnTarget} />
      </td>
      <td>
        <ResultBadge result={results.combined} />
      </td>
      {/* Row actions hand the selected match back to App for editing or deletion. */}
      <td className="actions">
        <button className="icon-button" onClick={() => onEdit(match)} aria-label={`Edit ${match.homeTeam} vs ${match.awayTeam}`} title="Edit">
          <Edit2 size={17} />
        </button>
        <button className="icon-button danger" onClick={() => onDelete(match.id)} aria-label={`Delete ${match.homeTeam} vs ${match.awayTeam}`} title="Delete">
          <Trash2 size={17} />
        </button>
      </td>
    </tr>
  );
}
