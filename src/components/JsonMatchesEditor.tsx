import { useEffect, useMemo, useState } from 'react';
import { Braces, Save, X } from 'lucide-react';
import type { Match, PredictionLine } from '../types';

type JsonMatchesEditorProps = {
  matches: Match[];
  open: boolean;
  onClose: () => void;
  onSave: (matches: Match[]) => void;
};

const requiredStringFields = ['date', 'competition', 'homeTeam', 'awayTeam'] as const;
const requiredNumberFields = ['predictedHomeGoals', 'predictedAwayGoals'] as const;

function isPredictionLine(value: unknown): value is PredictionLine {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const line = value as Partial<PredictionLine>;
  return (line.direction === 'over' || line.direction === 'under') && typeof line.value === 'number';
}

function normalizeMatch(value: unknown, index: number): Match {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Entry ${index + 1} must be an object.`);
  }

  const item = value as Partial<Match>;

  for (const field of requiredStringFields) {
    if (typeof item[field] !== 'string' || item[field].trim() === '') {
      throw new Error(`Entry ${index + 1} is missing "${field}".`);
    }
  }

  for (const field of requiredNumberFields) {
    if (typeof item[field] !== 'number' || Number.isNaN(item[field])) {
      throw new Error(`Entry ${index + 1} needs a numeric "${field}".`);
    }
  }

  for (const field of ['predictedTotalGoalsLine', 'predictedTotalShotsLine', 'predictedShotsOnTargetLine'] as const) {
    if (item[field] !== undefined && !isPredictionLine(item[field])) {
      throw new Error(`Entry ${index + 1} has an invalid "${field}".`);
    }
  }

  for (const field of ['actualHomeGoals', 'actualAwayGoals', 'actualTotalShots', 'actualShotsOnTarget'] as const) {
    if (item[field] !== undefined && (typeof item[field] !== 'number' || Number.isNaN(item[field]))) {
      throw new Error(`Entry ${index + 1} has an invalid "${field}".`);
    }
  }

  const date = item.date as string;
  const competition = item.competition as string;
  const homeTeam = item.homeTeam as string;
  const awayTeam = item.awayTeam as string;
  const predictedHomeGoals = item.predictedHomeGoals as number;
  const predictedAwayGoals = item.predictedAwayGoals as number;

  return {
    ...item,
    id: typeof item.id === 'string' && item.id.trim() !== '' ? item.id : crypto.randomUUID(),
    date: date.trim(),
    competition: competition.trim(),
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
    predictedHomeGoals,
    predictedAwayGoals,
    notes: typeof item.notes === 'string' ? item.notes.trim() : item.notes,
  };
}

function parseMatchesJson(value: string): Match[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('JSON must be an array of match objects.');
  }

  return parsed.map(normalizeMatch);
}

export function JsonMatchesEditor({ matches, open, onClose, onSave }: JsonMatchesEditorProps) {
  const serializedMatches = useMemo(() => JSON.stringify(matches, null, 2), [matches]);
  const [jsonValue, setJsonValue] = useState(serializedMatches);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setJsonValue(serializedMatches);
      setError('');
    }
  }, [open, serializedMatches]);

  if (!open) {
    return null;
  }

  function handleSave() {
    try {
      const nextMatches = parseMatchesJson(jsonValue);
      onSave(nextMatches);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The JSON could not be saved.');
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="json-modal" role="dialog" aria-modal="true" aria-labelledby="json-editor-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              <Braces size={16} />
              Local storage value
            </span>
            <h2 id="json-editor-title">Edit matches JSON</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close JSON editor" title="Close">
            <X size={18} />
          </button>
        </div>

        <textarea
          className="json-editor"
          spellCheck={false}
          value={jsonValue}
          onChange={(event) => {
            setJsonValue(event.target.value);
            setError('');
          }}
        />

        {error ? <p className="form-error">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            <Save size={18} />
            Save JSON
          </button>
        </div>
      </section>
    </div>
  );
}
