import { Edit2, Trash2 } from 'lucide-react';
import type { Match, PredictionResult } from '../types';
import { calculateMatchResults, formatLine } from '../utils/predictions';

type MatchRowProps = {
  match: Match;
  onEdit: (match: Match) => void;
  onDelete: (id: string) => void;
};

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
  const results = calculateMatchResults(match);
  const actualScore =
    match.actualHomeGoals === undefined || match.actualAwayGoals === undefined
      ? '-'
      : `${match.actualHomeGoals}-${match.actualAwayGoals}`;

  return (
    <tr>
      <td>
        <strong>{match.homeTeam}</strong>
        <span className="muted"> vs {match.awayTeam}</span>
        <small>{match.date} · {match.competition}</small>
      </td>
      <td>{match.predictedHomeGoals}-{match.predictedAwayGoals}</td>
      <td>{actualScore}</td>
      <td>
        {formatLine(match.predictedTotalGoalsLine)}
        <ResultBadge result={results.goals} />
      </td>
      <td>
        {formatLine(match.predictedTotalShotsLine)}
        <ResultBadge result={results.totalShots} />
      </td>
      <td>
        {formatLine(match.predictedShotsOnTargetLine)}
        <ResultBadge result={results.shotsOnTarget} />
      </td>
      <td>
        <ResultBadge result={results.combined} />
      </td>
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
