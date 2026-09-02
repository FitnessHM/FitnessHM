import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { PrescribedSession, CutShortReason } from '../../db/schema';
import { db } from '../../db/schema';
import { createSessionLog, countCutShortReasons, addTimedEffort } from '../../db/repository';
import {
  DEFAULT_DISCIPLINE,
  DISCIPLINES,
  disciplineConfig,
  type Discipline,
} from '../../lib/disciplines';
import { todayIso } from '../../lib/dates';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { sessionTypeLabel } from '../../components/SessionTypeIcon';
import ReasonCountTable from './ReasonCountTable';

const FIELD_CLASSES = 'block w-full mt-1.5 bg-surface border border-border-strong rounded-control p-3 font-body text-body text-primary focus:outline-none focus:border-accent';
const LABEL_CLASSES = 'block font-body text-label font-semibold uppercase tracking-wide text-secondary';

// Progressive enhancement only -- silently does nothing on iOS Safari,
// desktop, or any browser without the Vibration API.
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

interface Props {
  blockId: string;
  session: PrescribedSession | null;
  onSaved: () => void;
}

export default function SessionLogger({ blockId, session, onSaved }: Props) {
  const [actualReps, setActualReps] = useState('');
  const [actualDuration, setActualDuration] = useState('');
  const [actualDistance, setActualDistance] = useState('');
  const [recoveryScore, setRecoveryScore] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [temperatureC, setTemperatureC] = useState('');
  const [rpe, setRpe] = useState('');
  const [note, setNote] = useState('');
  const [cutShortReason, setCutShortReason] = useState<CutShortReason | ''>('');
  const [discipline, setDiscipline] = useState<Discipline | ''>('');

  const block = useLiveQuery(() => db.blocks.get(blockId), [blockId]);
  const reasonCounts = useLiveQuery(() => countCutShortReasons(blockId), [blockId]) ?? {};

  // A single-discipline block dictates the discipline; a "Mix" block lets the
  // athlete pick which one this session was, defaulting to the block's primary.
  const blockDisciplines = block?.disciplines?.length
    ? block.disciplines
    : [block?.discipline ?? DEFAULT_DISCIPLINE];
  const effectiveDiscipline: Discipline =
    discipline || block?.discipline || blockDisciplines[0] || DEFAULT_DISCIPLINE;
  const distanceHint = disciplineConfig(effectiveDiscipline).distanceHint;

  const toNumberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

  const handleSave = async () => {
    const date = todayIso();
    const actualDurationSeconds = toNumberOrNull(actualDuration);
    const actualDistanceMeters = toNumberOrNull(actualDistance);

    await createSessionLog({
      sessionId: session?.id ?? null,
      blockId,
      date,
      actualReps: toNumberOrNull(actualReps),
      actualDurationSeconds,
      actualDistanceMeters,
      recoveryScore: toNumberOrNull(recoveryScore),
      sleepHours: toNumberOrNull(sleepHours),
      temperatureC: toNumberOrNull(temperatureC),
      rpe: toNumberOrNull(rpe),
      note: note.trim() === '' ? null : note,
      cutShortReason: cutShortReason === '' ? null : cutShortReason,
      discipline: effectiveDiscipline,
    });

    // A logged time trial is a real checkpoint measurement -- record it so the
    // progression chart and feasibility read keep moving after the baseline.
    if (session?.type === 'time_trial' && actualDistanceMeters !== null && actualDurationSeconds !== null) {
      await addTimedEffort({
        blockId,
        date,
        distanceMeters: actualDistanceMeters,
        timeSeconds: actualDurationSeconds,
        kind: 'checkpoint',
      });
    }

    vibrate(40);
    onSaved();
  };

  return (
    <div className="mx-auto max-w-md space-y-5 p-4 pb-10">
      <Card className="space-y-1">
        {session ? (
          <p className="font-body text-body text-primary">
            <span className="font-display text-title">
              {session.reps ? `${session.reps} x ${sessionTypeLabel(session.type)}` : sessionTypeLabel(session.type)}
            </span>
            {session.targetDurationSeconds ? (
              <span className="ml-2 font-body text-caption text-secondary">
                {Math.round(session.targetDurationSeconds / 60)} min target
              </span>
            ) : null}
          </p>
        ) : (
          <p className="font-body text-body text-secondary">Logging an unscheduled session.</p>
        )}
      </Card>

      <div className="space-y-4">
        <label className={LABEL_CLASSES}>
          Discipline
          <select
            aria-label="discipline"
            value={effectiveDiscipline}
            onChange={(e) => setDiscipline(e.target.value as Discipline)}
            className={FIELD_CLASSES}
          >
            {blockDisciplines.map((d) => (
              <option key={d} value={d}>{DISCIPLINES[d].label}</option>
            ))}
          </select>
        </label>

        {session?.reps != null && (
          <label className={LABEL_CLASSES}>
            Reps completed
            <input aria-label="reps completed" value={actualReps} onChange={(e) => setActualReps(e.target.value)} className={FIELD_CLASSES} />
          </label>
        )}

        <label className={LABEL_CLASSES}>
          Duration (seconds)
          <input aria-label="duration" value={actualDuration} onChange={(e) => setActualDuration(e.target.value)} className={FIELD_CLASSES} />
        </label>

        <label className={LABEL_CLASSES}>
          Distance (meters)
          <input aria-label="distance" value={actualDistance} onChange={(e) => setActualDistance(e.target.value)} className={FIELD_CLASSES} />
          <span className="mt-1 block font-body text-caption normal-case tracking-normal text-secondary">
            {distanceHint}
          </span>
        </label>

        <details className="group">
          <summary className="cursor-pointer font-body text-caption font-semibold text-secondary">Optional details</summary>
          <div className="mt-3 space-y-4">
            <label className={LABEL_CLASSES}>
              Recovery score (1-5)
              <input aria-label="recovery score" value={recoveryScore} onChange={(e) => setRecoveryScore(e.target.value)} className={FIELD_CLASSES} />
            </label>
            <label className={LABEL_CLASSES}>
              Sleep (hours)
              <input aria-label="sleep hours" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} className={FIELD_CLASSES} />
            </label>
            <label className={LABEL_CLASSES}>
              Temperature (C)
              <input aria-label="temperature" value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} className={FIELD_CLASSES} />
            </label>
            <label className={LABEL_CLASSES}>
              RPE (1-10)
              <input aria-label="rpe" value={rpe} onChange={(e) => setRpe(e.target.value)} className={FIELD_CLASSES} />
            </label>
            <label className={LABEL_CLASSES}>
              Note
              <textarea aria-label="note" value={note} onChange={(e) => setNote(e.target.value)} className={FIELD_CLASSES} />
            </label>
          </div>
        </details>

        <label className={LABEL_CLASSES}>
          Cut short reason (optional)
          <select
            aria-label="cut short reason"
            value={cutShortReason}
            onChange={(e) => setCutShortReason(e.target.value as CutShortReason | '')}
            className={FIELD_CLASSES}
          >
            <option value="">Not cut short</option>
            <option value="heat">Heat</option>
            <option value="fatigue">Fatigue</option>
            <option value="pain">Pain</option>
            <option value="time">Time</option>
            <option value="life">Life</option>
          </select>
        </label>
      </div>

      <Button onClick={handleSave} className="w-full">
        Save
      </Button>

      <ReasonCountTable counts={reasonCounts} />
    </div>
  );
}
