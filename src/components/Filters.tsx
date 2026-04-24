import type { Match, MatchFilters } from '../types';

type FiltersProps = {
  filters: MatchFilters;
  matches: Match[];
  onChange: (filters: MatchFilters) => void;
};

export function Filters({ filters, matches, onChange }: FiltersProps) {
  const competitions = Array.from(new Set(matches.map((match) => match.competition).filter(Boolean))).sort();

  return (
    <section className="filters" aria-label="Match filters">
      <label>
        Competition
        <select
          value={filters.competition}
          onChange={(event) => onChange({ ...filters, competition: event.target.value })}
        >
          <option value="">All competitions</option>
          {competitions.map((competition) => (
            <option key={competition} value={competition}>
              {competition}
            </option>
          ))}
        </select>
      </label>

      <label>
        Team
        <input
          value={filters.teamName}
          onChange={(event) => onChange({ ...filters, teamName: event.target.value })}
          placeholder="Search team"
        />
      </label>

      <label>
        Combined
        <select value={filters.combined} onChange={(event) => onChange({ ...filters, combined: event.target.value as MatchFilters['combined'] })}>
          <option value="all">All results</option>
          <option value="correct">Correct only</option>
          <option value="incorrect">Incorrect only</option>
        </select>
      </label>
    </section>
  );
}
