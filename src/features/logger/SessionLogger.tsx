import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { PrescribedSession, CutShortReason } from '../../db/schema';
import { createSessionLog, countCutShortReasons, addTimedEffort } from '../../db/repository';
import ReasonCountTable from './ReasonCountTable';

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

  const reasonCounts = useLiveQuery(() => countCutShortReasons(blockId), [blockId]) ?? {};

  const toNumberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

  const handleSave = async () => {
    const date = new Date().toISOString().slice(0, 10);
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
    });

    // A logged time trial is a real checkpoint measurement — record it so the
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

    onSaved();
  };

  return (
    <div className="p-6 space-y-4 max-w-md mx-auto">
      {session ? (
        <p className="text-slate-300">
          Prescribed: {session.reps ? `${session.reps} x ${session.type}` : session.type}
          {session.targetDurationSeconds ? ` — ${Math.round(session.targetDurationSeconds / 60)} min` : ''}
        </p>
      ) : (
        <p className="text-slate-400">Logging an unscheduled session.</p>
      )}

      {session?.reps != null && (
        <label className="block">
          Reps completed
          <input aria-label="reps completed" value={actualReps} onChange={(e) => setActualReps(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
        </label>
      )}

      <label className="block">
        Duration (seconds)
        <input aria-label="duration" value={actualDuration} onChange={(e) => setActualDuration(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
      </label>

      <label className="block">
        Distance (meters)
        <input aria-label="distance" value={actualDistance} onChange={(e) => setActualDistance(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
      </label>

      <details className="text-sm">
        <summary className="cursor-pointer text-slate-400">Optional details</summary>
        <div className="space-y-3 mt-3">
          <label className="block">
            Recovery score (1-5)
            <input aria-label="recovery score" value={recoveryScore} onChange={(e) => setRecoveryScore(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
          </label>
          <label className="block">
            Sleep (hours)
            <input aria-label="sleep hours" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
          </label>
          <label className="block">
            Temperature (C)
            <input aria-label="temperature" value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
          </label>
          <label className="block">
            RPE (1-10)
            <input aria-label="rpe" value={rpe} onChange={(e) => setRpe(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
          </label>
          <label className="block">
            Note
            <textarea aria-label="note" value={note} onChange={(e) => setNote(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
          </label>
        </div>
      </details>

      <label className="block">
        Cut short reason (optional)
        <select aria-label="cut short reason" value={cutShortReason} onChange={(e) => setCutShortReason(e.target.value as CutShortReason | '')} className="block w-full mt-1 bg-slate-900 p-2 rounded">
          <option value="">Not cut short</option>
          <option value="heat">Heat</option>
          <option value="fatigue">Fatigue</option>
          <option value="pain">Pain</option>
          <option value="time">Time</option>
          <option value="life">Life</option>
        </select>
      </label>

      <button type="button" onClick={handleSave} className="w-full py-3 bg-blue-600 rounded font-semibold">Save</button>

      <ReasonCountTable counts={reasonCounts} />
    </div>
  );
}
