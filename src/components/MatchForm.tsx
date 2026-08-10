import { FormEvent, useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import type { Match, PredictionDirection } from '../types';
import { parseLine } from '../utils/predictions';
import { competitions, teamsByCompetition } from '../data/competition';

type MatchFormProps = {
  editingMatch?: Match | null;
  onSave: (match: Match) => void;
  onCancelEdit: () => void;
};

// Form state stores numbers as strings so inputs can be empty while the user edits.
type FormState = {
  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  predictedHomeGoals: string;
  predictedAwayGoals: string;
  goalDirection: '' | PredictionDirection;
  goalValue: string;
  shotsDirection: '' | PredictionDirection;
  shotsValue: string;
  sotDirection: '' | PredictionDirection;
  sotValue: string;
  actualHomeGoals: string;
  actualAwayGoals: string;
  actualHomeShots: string;
  actualAwayShots: string;
  actualHomeShotsOnTarget: string;
  actualAwayShotsOnTarget: string;
  notes: string;
};

// Defaults create a ready-to-use new-match form with common prediction line values.
const emptyState: FormState = {
  date: new Date().toISOString().slice(0, 10),
  competition: '',
  homeTeam: '',
  awayTeam: '',
  predictedHomeGoals: '',
  predictedAwayGoals: '',
  goalDirection: 'over',
  goalValue: '1.5',
  shotsDirection: 'under',
  shotsValue: '27.5',
  sotDirection: 'under',
  sotValue: '9.5',
  actualHomeGoals: '',
  actualAwayGoals: '',
  actualHomeShots: '',
  actualAwayShots: '',
  actualHomeShotsOnTarget: '',
  actualAwayShotsOnTarget: '',
  notes: '',
};

// Empty actual-stat fields remain undefined until the result is known.
function numberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

// Required predicted score fields fall back to zero if left blank.
function numberOrZero(value: string): number {
  return value.trim() === '' ? 0 : Number(value);
}

function derivedTotal(first?: number, second?: number): number | undefined {
  return first === undefined || second === undefined ? undefined : first + second;
}

export function MatchForm({ editingMatch, onSave, onCancelEdit }: MatchFormProps) {
  const [form, setForm] = useState<FormState>(emptyState);
  const [error, setError] = useState('');

  // Populate the form when editing, or reset it when switching back to add mode.
  useEffect(() => {
    if (!editingMatch) {
      setForm(emptyState);
      setError('');
      return;
    }

    setForm({
      date: editingMatch.date,
      competition: editingMatch.competition,
      homeTeam: editingMatch.homeTeam,
      awayTeam: editingMatch.awayTeam,
      predictedHomeGoals: String(editingMatch.predictedHomeGoals),
      predictedAwayGoals: String(editingMatch.predictedAwayGoals),
      goalDirection: editingMatch.predictedTotalGoalsLine?.direction ?? '',
      goalValue: editingMatch.predictedTotalGoalsLine ? String(editingMatch.predictedTotalGoalsLine.value) : '',
      shotsDirection: editingMatch.predictedTotalShotsLine?.direction ?? '',
      shotsValue: editingMatch.predictedTotalShotsLine ? String(editingMatch.predictedTotalShotsLine.value) : '',
      sotDirection: editingMatch.predictedShotsOnTargetLine?.direction ?? '',
      sotValue: editingMatch.predictedShotsOnTargetLine ? String(editingMatch.predictedShotsOnTargetLine.value) : '',
      actualHomeGoals: editingMatch.actualHomeGoals === undefined ? '' : String(editingMatch.actualHomeGoals),
      actualAwayGoals: editingMatch.actualAwayGoals === undefined ? '' : String(editingMatch.actualAwayGoals),
      actualHomeShots: editingMatch.actualHomeShots === undefined ? '' : String(editingMatch.actualHomeShots),
      actualAwayShots: editingMatch.actualAwayShots === undefined ? '' : String(editingMatch.actualAwayShots),
      actualHomeShotsOnTarget:
        editingMatch.actualHomeShotsOnTarget === undefined ? '' : String(editingMatch.actualHomeShotsOnTarget),
      actualAwayShotsOnTarget:
        editingMatch.actualAwayShotsOnTarget === undefined ? '' : String(editingMatch.actualAwayShotsOnTarget),
      notes: editingMatch.notes ?? '',
    });
    setError('');
  }, [editingMatch]);

  // Small field updater keeps input handlers short and consistent.
  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  }

  // Changing competition clears teams so a stale team is not kept from another league.
  function updateCompetition(competition: string) {
    setForm((current) => ({
      ...current,
      competition,
      homeTeam: '',
      awayTeam: '',
    }));
  }


  // Convert input strings into the Match shape and pass it back to the app.
  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const actualHomeShots = numberOrUndefined(form.actualHomeShots);
    const actualAwayShots = numberOrUndefined(form.actualAwayShots);
    const actualHomeShotsOnTarget = numberOrUndefined(form.actualHomeShotsOnTarget);
    const actualAwayShotsOnTarget = numberOrUndefined(form.actualAwayShotsOnTarget);

    if (
      actualHomeShots !== undefined &&
      actualHomeShotsOnTarget !== undefined &&
      actualHomeShotsOnTarget > actualHomeShots
    ) {
      setError('Actual home SoT cannot be greater than actual home shots.');
      return;
    }

    if (
      actualAwayShots !== undefined &&
      actualAwayShotsOnTarget !== undefined &&
      actualAwayShotsOnTarget > actualAwayShots
    ) {
      setError('Actual away SoT cannot be greater than actual away shots.');
      return;
    }

    onSave({
      id: editingMatch?.id ?? crypto.randomUUID(),
      date: form.date,
      competition: form.competition.trim(),
      homeTeam: form.homeTeam.trim(),
      awayTeam: form.awayTeam.trim(),
      predictedHomeGoals: numberOrZero(form.predictedHomeGoals),
      predictedAwayGoals: numberOrZero(form.predictedAwayGoals),
      predictedTotalGoalsLine: parseLine(form.goalDirection, form.goalValue),
      predictedTotalShotsLine: parseLine(form.shotsDirection, form.shotsValue),
      predictedShotsOnTargetLine: parseLine(form.sotDirection, form.sotValue),
      actualHomeGoals: numberOrUndefined(form.actualHomeGoals),
      actualAwayGoals: numberOrUndefined(form.actualAwayGoals),
      actualHomeShots,
      actualAwayShots,
      actualHomeShotsOnTarget,
      actualAwayShotsOnTarget,
      actualTotalShots: derivedTotal(actualHomeShots, actualAwayShots),
      actualShotsOnTarget: derivedTotal(actualHomeShotsOnTarget, actualAwayShotsOnTarget),
      notes: form.notes.trim(),
    });

    setForm(emptyState);
    setError('');
  }

  // Team dropdown options depend on the selected competition.
  const availableTeams = form.competition
  ? teamsByCompetition[form.competition as keyof typeof teamsByCompetition]
  : [];

  return (
    <form className="match-form" onSubmit={handleSubmit}>
      {/* Form header switches labels depending on add or edit mode. */}
      <div className="form-header">
        <div>
          <h2>{editingMatch ? 'Edit match' : 'Add match'}</h2>
          <p>{editingMatch ? 'Update predictions or add final stats.' : 'Track a new prediction before kickoff.'}</p>
        </div>
        {editingMatch ? (
          <button type="button" className="icon-button" onClick={onCancelEdit} aria-label="Cancel edit" title="Cancel edit">
            <X size={18} />
          </button>
        ) : null}
      </div>

      {/* Fixture identity and predicted score fields. */}
      <div className="form-grid">
        <label>
          Date
          <input required type="date" value={form.date} onChange={(event) => update('date', event.target.value)} />
        </label>
        <label>
          Competition
          <select required value={form.competition} onChange={(event) => updateCompetition(event.target.value)}>
            <option value="">Select competition</option>
            {competitions.map((competition) => (
              <option key={competition} value={competition}>
                {competition}
              </option>
            ))}
          </select>
        </label>
        <label>
          Home team
          <select required value={form.homeTeam} onChange={(event) => update('homeTeam', event.target.value)} disabled={!form.competition}>
            <option value="">Select home team</option>
            {availableTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>
        <label>
          Away team
          <select required value={form.awayTeam} onChange={(event) => update('awayTeam', event.target.value)} disabled={!form.competition}>
            <option value="">Select away team</option>
            {availableTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pred home goals
          <input required min="0" type="number" value={form.predictedHomeGoals} onChange={(event) => update('predictedHomeGoals', event.target.value)} />
        </label>
        <label>
          Pred away goals
          <input required min="0" type="number" value={form.predictedAwayGoals} onChange={(event) => update('predictedAwayGoals', event.target.value)} />
        </label>
      </div>

      {/* Optional over/under prediction lines tracked against final stats. */}
      <div className="line-grid">
        <LineInput title="Goal line" direction={form.goalDirection} value={form.goalValue} onDirection={(value) => update('goalDirection', value)} onValue={(value) => update('goalValue', value)} />
        <LineInput title="Shots line" direction={form.shotsDirection} value={form.shotsValue} onDirection={(value) => update('shotsDirection', value)} onValue={(value) => update('shotsValue', value)} />
        <LineInput title="SoT line" direction={form.sotDirection} value={form.sotValue} onDirection={(value) => update('sotDirection', value)} onValue={(value) => update('sotValue', value)} />
      </div>

      {/* Optional actual result fields drive dashboard accuracy after a match finishes. */}
      <div className="form-grid">
        <label>
          Actual home goals
          <input min="0" type="number" value={form.actualHomeGoals} onChange={(event) => update('actualHomeGoals', event.target.value)} />
        </label>
        <label>
          Actual away goals
          <input min="0" type="number" value={form.actualAwayGoals} onChange={(event) => update('actualAwayGoals', event.target.value)} />
        </label>
        <label>
          Actual home shots
          <input min="0" type="number" value={form.actualHomeShots} onChange={(event) => update('actualHomeShots', event.target.value)} />
        </label>
        <label>
          Actual away shots
          <input min="0" type="number" value={form.actualAwayShots} onChange={(event) => update('actualAwayShots', event.target.value)} />
        </label>
        <label>
          Actual home shots on target
          <input min="0" type="number" value={form.actualHomeShotsOnTarget} onChange={(event) => update('actualHomeShotsOnTarget', event.target.value)} />
        </label>
        <label>
          Actual away shots on target
          <input min="0" type="number" value={form.actualAwayShotsOnTarget} onChange={(event) => update('actualAwayShotsOnTarget', event.target.value)} />
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}

      {/* Free-form notes are stored on the match but do not affect calculations. */}
      <label>
        Notes
        <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={3} />
      </label>

      <button className="primary-button" type="submit">
        <Save size={18} />
        {editingMatch ? 'Save changes' : 'Add match'}
      </button>
    </form>
  );
}

// Reusable mini-control for each over/under prediction line.
function LineInput({
  title,
  direction,
  value,
  onDirection,
  onValue,
}: {
  title: string;
  direction: '' | PredictionDirection;
  value: string;
  onDirection: (value: '' | PredictionDirection) => void;
  onValue: (value: string) => void;
}) {
  return (
    <fieldset className="line-input">
      <legend>{title}</legend>
      <select value={direction} onChange={(event) => onDirection(event.target.value as '' | PredictionDirection)}>
        <option value="">None</option>
        <option value="over">Over</option>
        <option value="under">Under</option>
      </select>
      <input step="1.0" type="number" value={value} onChange={(event) => onValue(event.target.value)} />
    </fieldset>
  );
}
