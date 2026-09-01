import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { GoalType, BaselineSource, OtherTraining } from '../../db/schema';
import { saveAthlete, startNewBlock, addTimedEffort, createPrescribedSession } from '../../db/repository';
import { isoDateLocal, todayIso } from '../../lib/dates';
import Button from '../../components/Button';
import Card from '../../components/Card';

const EVENTS: Record<string, number> = { Mile: 1609, '5K': 5000, '10K': 10000, 'Half Marathon': 21097.5, Marathon: 42195 };
const OTHER_TRAINING_OPTIONS: OtherTraining[] = ['lifting', 'sport', 'classes', 'none'];
const QUESTION_COUNT = 4;

const FIELD_CLASSES = 'block w-full mt-1.5 bg-surface border border-border-strong rounded-control p-3 font-body text-body text-primary focus:outline-none focus:border-accent';
const LABEL_CLASSES = 'block font-body text-label font-semibold uppercase tracking-wide text-secondary';

function parseMmSs(value: string): number | null {
  const match = value.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

interface Props {
  onComplete: (blockId: string) => void;
  showWelcome?: boolean;
}

export default function OnboardingWizard({ onComplete, showWelcome = false }: Props) {
  const [step, setStep] = useState(showWelcome ? 0 : 1);
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

  if (step === 0) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 text-center">
        <p className="font-display text-display leading-none text-primary">FitnessHM</p>
        <p className="font-body text-body text-secondary">
          Tell us your goal and we'll build a real training block for it -- then adjust it based on what actually
          happens, not what was supposed to.
        </p>
        <Button onClick={() => setStep(1)} className="w-full">
          Get started
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <WizardHeader step={step} onBack={() => setStep(step - 1)} showBack={step > 1 || showWelcome} />

      {step === 1 && (
        <Card as="fieldset" className="space-y-4">
          <label className={LABEL_CLASSES}>
            Event
            <select aria-label="event" value={eventLabel} onChange={(e) => setEventLabel(e.target.value)} className={FIELD_CLASSES}>
              {Object.keys(EVENTS).map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className={LABEL_CLASSES}>
            Goal type
            <select aria-label="goal type" value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)} className={FIELD_CLASSES}>
              <option value="time">Time goal</option>
              <option value="finish">Just finish</option>
              <option value="consistency">Get consistent</option>
            </select>
          </label>
          {goalType === 'time' && (
            <label className={LABEL_CLASSES}>
              Goal time (mm:ss)
              <input aria-label="goal time" value={goalTime} onChange={(e) => setGoalTime(e.target.value)} placeholder="23:00" className={FIELD_CLASSES} />
              {goalTime !== '' && goalTimeSeconds === null && (
                <p className="mt-1 font-body text-caption text-caution">Enter a time as mm:ss, e.g. 23:00</p>
              )}
            </label>
          )}
          <Button disabled={!step1Valid} onClick={() => setStep(2)} className="w-full">Next</Button>
        </Card>
      )}

      {step === 2 && (
        <Card as="fieldset" className="space-y-4">
          <label className={LABEL_CLASSES}>
            Target date
            <input aria-label="target date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={FIELD_CLASSES} />
          </label>
          <Button disabled={!step2Valid} onClick={() => setStep(3)} className="w-full">Next</Button>
        </Card>
      )}

      {step === 3 && (
        <Card as="fieldset" className="space-y-4">
          <label className={LABEL_CLASSES}>
            Baseline
            <select aria-label="baseline" value={baselineSource} onChange={(e) => setBaselineSource(e.target.value as BaselineSource)} className={FIELD_CLASSES}>
              <option value="known">I know a recent time</option>
              <option value="estimate">I can estimate</option>
              <option value="unknown">No idea</option>
            </select>
          </label>
          {baselineSource !== 'unknown' && (
            <label className={LABEL_CLASSES}>
              Baseline time (mm:ss)
              <input aria-label="baseline time" value={baselineTime} onChange={(e) => setBaselineTime(e.target.value)} placeholder="25:30" className={FIELD_CLASSES} />
              {baselineTime !== '' && baselineTimeSeconds === null && (
                <p className="mt-1 font-body text-caption text-caution">Enter a time as mm:ss, e.g. 25:30</p>
              )}
            </label>
          )}
          <Button disabled={!step3Valid} onClick={() => setStep(4)} className="w-full">Next</Button>
        </Card>
      )}

      {step === 4 && (
        <Card as="fieldset" className="space-y-4">
          <label className={LABEL_CLASSES}>
            Days per week
            <input aria-label="days per week" type="number" min={1} max={7} value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))} className={FIELD_CLASSES} />
          </label>
          <div>
            <p className={LABEL_CLASSES}>Other training happening</p>
            <div className="mt-2 space-y-2">
              {OTHER_TRAINING_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 font-body text-body capitalize text-primary">
                  <input aria-label={option} type="checkbox" checked={otherTraining.includes(option)} onChange={() => toggleOtherTraining(option)} />
                  {option}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={handleFinish} className="w-full">Finish</Button>
        </Card>
      )}
    </div>
  );
}

function WizardHeader({ step, onBack, showBack }: { step: number; onBack: () => void; showBack: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {showBack ? (
        <button type="button" onClick={onBack} aria-label="back" className="pressable text-secondary">
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : (
        <div className="w-5" />
      )}
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: QUESTION_COUNT }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i + 1 <= step ? 'bg-accent' : 'bg-border-strong'}`}
          />
        ))}
      </div>
      <span className="font-body text-caption text-faint">{step}/{QUESTION_COUNT}</span>
    </div>
  );
}
