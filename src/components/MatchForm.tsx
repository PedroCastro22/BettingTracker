import { FormEvent, useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import type { Match, PredictionDirection } from '../types';
import { parseLine } from '../utils/predictions';

type MatchFormProps = {
  editingMatch?: Match | null;
  onSave: (match: Match) => void;
  onCancelEdit: () => void;
};

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
  actualTotalShots: string;
  actualShotsOnTarget: string;
  notes: string;
};

const emptyState: FormState = {
  date: new Date().toISOString().slice(0, 10),
  competition: '',
  homeTeam: '',
  awayTeam: '',
  predictedHomeGoals: '',
  predictedAwayGoals: '',
  goalDirection: 'over',
  goalValue: '2.5',
  shotsDirection: 'under',
  shotsValue: '27.5',
  sotDirection: 'under',
  sotValue: '9.5',
  actualHomeGoals: '',
  actualAwayGoals: '',
  actualTotalShots: '',
  actualShotsOnTarget: '',
  notes: '',
};

function numberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

function numberOrZero(value: string): number {
  return value.trim() === '' ? 0 : Number(value);
}

export function MatchForm({ editingMatch, onSave, onCancelEdit }: MatchFormProps) {
  const [form, setForm] = useState<FormState>(emptyState);

  useEffect(() => {
    if (!editingMatch) {
      setForm(emptyState);
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
      actualTotalShots: editingMatch.actualTotalShots === undefined ? '' : String(editingMatch.actualTotalShots),
      actualShotsOnTarget:
        editingMatch.actualShotsOnTarget === undefined ? '' : String(editingMatch.actualShotsOnTarget),
      notes: editingMatch.notes ?? '',
    });
  }, [editingMatch]);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

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
      actualTotalShots: numberOrUndefined(form.actualTotalShots),
      actualShotsOnTarget: numberOrUndefined(form.actualShotsOnTarget),
      notes: form.notes.trim(),
    });

    setForm(emptyState);
  }

  return (
    <form className="match-form" onSubmit={handleSubmit}>
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

      <div className="form-grid">
        <label>
          Date
          <input required type="date" value={form.date} onChange={(event) => update('date', event.target.value)} />
        </label>
        <label>
          Competition
          <select required value={form.competition} onChange={(event) => update('competition', event.target.value)}>
            <option value="">Select competition</option>
            <option value="La Liga">La Liga</option>
            <option value="Serie A">Serie A</option>
            <option value="Brasileirao">Brasileirao</option>
          </select>
        </label>
        <label>
          Home team
          <input required value={form.homeTeam} onChange={(event) => update('homeTeam', event.target.value)} />
        </label>
        <label>
          Away team
          <input required value={form.awayTeam} onChange={(event) => update('awayTeam', event.target.value)} />
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

      <div className="line-grid">
        <LineInput title="Goal line" direction={form.goalDirection} value={form.goalValue} onDirection={(value) => update('goalDirection', value)} onValue={(value) => update('goalValue', value)} />
        <LineInput title="Shots line" direction={form.shotsDirection} value={form.shotsValue} onDirection={(value) => update('shotsDirection', value)} onValue={(value) => update('shotsValue', value)} />
        <LineInput title="SoT line" direction={form.sotDirection} value={form.sotValue} onDirection={(value) => update('sotDirection', value)} onValue={(value) => update('sotValue', value)} />
      </div>

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
          Actual total shots
          <input min="0" type="number" value={form.actualTotalShots} onChange={(event) => update('actualTotalShots', event.target.value)} />
        </label>
        <label>
          Actual SoT
          <input min="0" type="number" value={form.actualShotsOnTarget} onChange={(event) => update('actualShotsOnTarget', event.target.value)} />
        </label>
      </div>

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
      <input step="0.5" type="number" value={value} onChange={(event) => onValue(event.target.value)} />
    </fieldset>
  );
}
