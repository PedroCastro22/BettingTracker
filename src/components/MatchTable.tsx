import type { Match } from '../types';
import { MatchRow } from './MatchRow';

type MatchTableProps = {
  matches: Match[];
  onEdit: (match: Match) => void;
  onDelete: (id: string) => void;
};

export function MatchTable({ matches, onEdit, onDelete }: MatchTableProps) {
  return (
    <section className="table-section">
      {/* Section header gives the user quick feedback on filtered row count. */}
      <div className="section-heading">
        <h2>Recent matches</h2>
        <span>{matches.length} shown</span>
      </div>

      {/* Horizontal wrapper keeps the stat-heavy table usable on smaller screens. */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Match</th>
              <th>Pred score</th>
              <th>Actual</th>
              <th>Goals</th>
              <th>Shots</th>
              <th>SoT</th>
              <th>Combined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* MatchRow owns row-specific calculations, badges, and action buttons. */}
            {matches.map((match) => (
              <MatchRow key={match.id} match={match} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </tbody>
        </table>

        {matches.length === 0 ? <p className="empty-state">No matches match the current filters.</p> : null}
      </div>
    </section>
  );
}
