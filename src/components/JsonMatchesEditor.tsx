import { useEffect, useMemo, useState } from 'react';
import { Braces, Save, X } from 'lucide-react';
import type { Match, PredictionLine } from '../types';

type JsonMatchesEditorProps = {
  matches: Match[];
  open: boolean;
  season: string;
  model: string;
  databaseName: string;
  onClose: () => void;
  onSave: (matches: Match[]) => void;
};

// Required fields keep imported JSON compatible with the tracker UI and calculations.
const requiredStringFields = ['date', 'competition', 'homeTeam', 'awayTeam'] as const;
const requiredNumberFields = ['predictedHomeGoals', 'predictedAwayGoals'] as const;

// Validate optional line objects before accepting imported match JSON.
function isPredictionLine(value: unknown): value is PredictionLine {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const line = value as Partial<PredictionLine>;
  return (line.direction === 'over' || line.direction === 'under') && typeof line.value === 'number';
}

// Validate and normalize one imported match entry.
function normalizeMatch(value: unknown, index: number): Match {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Entry ${index + 1} must be an object.`);
  }

  const item = value as Partial<Match>;

  // Core strings are required because the table and form cannot render unnamed fixtures.
  for (const field of requiredStringFields) {
    if (typeof item[field] !== 'string' || item[field].trim() === '') {
      throw new Error(`Entry ${index + 1} is missing "${field}".`);
    }
  }

  // Predicted scores are required because every tracker row displays them.
  for (const field of requiredNumberFields) {
    if (typeof item[field] !== 'number' || Number.isNaN(item[field])) {
      throw new Error(`Entry ${index + 1} needs a numeric "${field}".`);
    }
  }

  // Optional predicted lines must still be valid when present.
  for (const field of ['predictedTotalGoalsLine', 'predictedTotalShotsLine', 'predictedShotsOnTargetLine'] as const) {
    if (item[field] !== undefined && !isPredictionLine(item[field])) {
      throw new Error(`Entry ${index + 1} has an invalid "${field}".`);
    }
  }

  // Optional final stats must be numeric when present so accuracy calculations are reliable.
  for (const field of [
    'actualHomeGoals',
    'actualAwayGoals',
    'actualHomeShots',
    'actualAwayShots',
    'actualHomeShotsOnTarget',
    'actualAwayShotsOnTarget',
    'actualTotalShots',
    'actualShotsOnTarget',
  ] as const) {
    if (item[field] !== undefined && (typeof item[field] !== 'number' || Number.isNaN(item[field]))) {
      throw new Error(`Entry ${index + 1} has an invalid "${field}".`);
    }
  }

  if (
    item.actualHomeShots !== undefined &&
    item.actualHomeShotsOnTarget !== undefined &&
    item.actualHomeShotsOnTarget > item.actualHomeShots
  ) {
    throw new Error(`Entry ${index + 1} has more home shots on target than home shots.`);
  }

  if (
    item.actualAwayShots !== undefined &&
    item.actualAwayShotsOnTarget !== undefined &&
    item.actualAwayShotsOnTarget > item.actualAwayShots
  ) {
    throw new Error(`Entry ${index + 1} has more away shots on target than away shots.`);
  }

  const date = item.date as string;
  const competition = item.competition as string;
  const homeTeam = item.homeTeam as string;
  const awayTeam = item.awayTeam as string;
  const predictedHomeGoals = item.predictedHomeGoals as number;
  const predictedAwayGoals = item.predictedAwayGoals as number;
  const actualTotalShots =
    item.actualHomeShots !== undefined && item.actualAwayShots !== undefined
      ? item.actualHomeShots + item.actualAwayShots
      : item.actualTotalShots;
  const actualShotsOnTarget =
    item.actualHomeShotsOnTarget !== undefined && item.actualAwayShotsOnTarget !== undefined
      ? item.actualHomeShotsOnTarget + item.actualAwayShotsOnTarget
      : item.actualShotsOnTarget;

  // Keep any optional imported fields, but trim user-facing strings and create missing ids.
  return {
    ...item,
    id: typeof item.id === 'string' && item.id.trim() !== '' ? item.id : crypto.randomUUID(),
    date: date.trim(),
    competition: competition.trim(),
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
    predictedHomeGoals,
    predictedAwayGoals,
    actualTotalShots,
    actualShotsOnTarget,
    notes: typeof item.notes === 'string' ? item.notes.trim() : item.notes,
  };
}

// Parse the modal textarea into a normalized array of tracker matches.
function parseMatchesJson(value: string): Match[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('JSON must be an array of match objects.');
  }

  return parsed.map(normalizeMatch);
}

export function JsonMatchesEditor({ matches, open, season, model, databaseName, onClose, onSave }: JsonMatchesEditorProps) {
  // Keep the textarea synced with the latest matches each time the modal opens.
  const serializedMatches = useMemo(() => JSON.stringify(matches, null, 2), [matches]);
  const [jsonValue, setJsonValue] = useState(serializedMatches);
  const [error, setError] = useState('');

  // Reset modal contents and clear stale validation errors when opened.
  useEffect(() => {
    if (open) {
      setJsonValue(serializedMatches);
      setError('');
    }
  }, [open, serializedMatches]);

  if (!open) {
    return null;
  }

  // Validate JSON before replacing the saved tracker state.
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
      {/* Dialog wraps the raw localStorage-style JSON editor. */}
      <section className="json-modal" role="dialog" aria-modal="true" aria-labelledby="json-editor-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              <Braces size={16} />
              {season} / {model}
            </span>
            <h2 id="json-editor-title">Edit matches JSON</h2>
            <p className="storage-key">
              Saved under <code>{databaseName}</code>
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close JSON editor" title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Main editable JSON payload. */}
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

        {/* Footer actions either discard textarea edits or save validated JSON. */}
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
