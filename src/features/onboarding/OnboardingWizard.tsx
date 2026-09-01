import { useState } from 'react';
import type { GoalType, BaselineSource, OtherTraining } from '../../db/schema';
import { saveAthlete, startNewBlock, addTimedEffort, createPrescribedSession } from '../../db/repository';
import { isoDateLocal, todayIso } from '../../lib/dates';

const EVENTS: Record<string, number> = { Mile: 1609, '5K': 5000, '10K': 10000, 'Half Marathon': 21097.5, Marathon: 42195 };
const OTHER_TRAINING_OPTIONS: OtherTraining[] = ['lifting', 'sport', 'classes', 'none'];

function parseMmSs(value: string): number | null {
  const match = value.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

interface Props {
  onComplete: (blockId: string) => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [eventLabel, setEventLabel] = useState('5K');
  const [goalType, setGoalType] = useState<GoalType>('time');
  const [goalTime, setGoalTime] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [baselineSource, setBaselineSource] = useState<BaselineSource>('unknown');
  const [baselineTime, setBaselineTime] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [otherTraining, setOtherTraining] = useState<OtherTraining[]>([]);

  const goalTimeSeconds = parseMmSs(goalTime);
  const baselineTimeSeconds = parseMmSs(baselineTime);
  const step1Valid = goalType !== 'time' || goalTimeSeconds !== null;
  const step2Valid = targetDate !== '';
  const step3Valid = baselineSource === 'unknown' || baselineTimeSeconds !== null;

  const toggleOtherTraining = (option: OtherTraining) => {
    setOtherTraining((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  };

  const handleFinish = async () => {
    await saveAthlete(daysPerWeek, otherTraining);
    const eventDistanceMeters = EVENTS[eventLabel];
    const block = await startNewBlock({
      eventDistanceMeters,
      eventLabel,
      goalType,
      goalTimeSeconds: goalType === 'time' ? goalTimeSeconds : null,
      targetDate,
      baselineSource,
      raceMantra: null,
      targetSplitSecondsPerKm: null,
    });

    if (baselineSource !== 'unknown') {
      if (baselineTimeSeconds !== null) {
        await addTimedEffort({
          blockId: block.id,
          date: todayIso(),
          distanceMeters: eventDistanceMeters,
          timeSeconds: baselineTimeSeconds,
          kind: 'baseline',
        });
      }
    } else {
      const weekOne = isoDateLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      await createPrescribedSession({
        blockId: block.id,
        date: weekOne,
        type: 'time_trial',
        reps: null, targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: null,
        note: 'A baseline test tells us where you are really starting from.',
      });
    }

    onComplete(block.id);
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      {step === 1 && (
        <fieldset className="space-y-4">
          <label className="block">
            Event
            <select aria-label="event" value={eventLabel} onChange={(e) => setEventLabel(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded">
              {Object.keys(EVENTS).map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className="block">
            Goal type
            <select aria-label="goal type" value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)} className="block w-full mt-1 bg-slate-900 p-2 rounded">
              <option value="time">Time goal</option>
              <option value="finish">Just finish</option>
              <option value="consistency">Get consistent</option>
            </select>
          </label>
          {goalType === 'time' && (
            <label className="block">
              Goal time (mm:ss)
              <input aria-label="goal time" value={goalTime} onChange={(e) => setGoalTime(e.target.value)} placeholder="23:00" className="block w-full mt-1 bg-slate-900 p-2 rounded" />
              {goalTime !== '' && goalTimeSeconds === null && (
                <p className="text-amber-300 text-sm">Enter a time as mm:ss, e.g. 23:00</p>
              )}
            </label>
          )}
          <button type="button" disabled={!step1Valid} onClick={() => setStep(2)} className="w-full py-3 bg-blue-600 rounded font-semibold disabled:opacity-50">Next</button>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="space-y-4">
          <label className="block">
            Target date
            <input aria-label="target date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
          </label>
          <button type="button" disabled={!step2Valid} onClick={() => setStep(3)} className="w-full py-3 bg-blue-600 rounded font-semibold disabled:opacity-50">Next</button>
        </fieldset>
      )}

      {step === 3 && (
        <fieldset className="space-y-4">
          <label className="block">
            Baseline
            <select aria-label="baseline" value={baselineSource} onChange={(e) => setBaselineSource(e.target.value as BaselineSource)} className="block w-full mt-1 bg-slate-900 p-2 rounded">
              <option value="known">I know a recent time</option>
              <option value="estimate">I can estimate</option>
              <option value="unknown">No idea</option>
            </select>
          </label>
          {baselineSource !== 'unknown' && (
            <label className="block">
              Baseline time (mm:ss)
              <input aria-label="baseline time" value={baselineTime} onChange={(e) => setBaselineTime(e.target.value)} placeholder="25:30" className="block w-full mt-1 bg-slate-900 p-2 rounded" />
              {baselineTime !== '' && baselineTimeSeconds === null && (
                <p className="text-amber-300 text-sm">Enter a time as mm:ss, e.g. 25:30</p>
              )}
            </label>
          )}
          <button type="button" disabled={!step3Valid} onClick={() => setStep(4)} className="w-full py-3 bg-blue-600 rounded font-semibold disabled:opacity-50">Next</button>
        </fieldset>
      )}

      {step === 4 && (
        <fieldset className="space-y-4">
          <label className="block">
            Days per week
            <input aria-label="days per week" type="number" min={1} max={7} value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))} className="block w-full mt-1 bg-slate-900 p-2 rounded" />
          </label>
          <button type="button" onClick={() => setStep(5)} className="w-full py-3 bg-blue-600 rounded font-semibold">Next</button>
        </fieldset>
      )}

      {step === 5 && (
        <fieldset className="space-y-4">
          <p>Other training happening</p>
          {OTHER_TRAINING_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input aria-label={option} type="checkbox" checked={otherTraining.includes(option)} onChange={() => toggleOtherTraining(option)} />
              {option}
            </label>
          ))}
          <button type="button" onClick={handleFinish} className="w-full py-3 bg-green-600 rounded font-semibold">Finish</button>
        </fieldset>
      )}
    </div>
  );
}
