import { useState } from 'react';
import { ChevronLeft, Shuffle } from 'lucide-react';
import type { GoalType, BaselineSource, OtherTraining } from '../../db/schema';
import {
  DISCIPLINES,
  DISCIPLINE_LIST,
  MIX_DISCIPLINE_LIST,
  DEFAULT_DISCIPLINE,
  LEVELS,
  disciplineConfig,
  isGeneralFitnessEvent,
  levelLabel,
  type Discipline,
  type Level,
} from '../../lib/disciplines';
import { saveAthlete, startNewBlock, addTimedEffort, createPrescribedSession } from '../../db/repository';
import { isoDateLocal, todayIso } from '../../lib/dates';
import Button from '../../components/Button';
import Card from '../../components/Card';

const OTHER_TRAINING_OPTIONS: OtherTraining[] = ['lifting', 'sport', 'classes', 'none'];
const QUESTION_COUNT = 6;

const FIELD_CLASSES = 'block w-full mt-1.5 bg-surface border border-border-strong rounded-control p-3 font-body text-body text-primary focus:outline-none focus:border-accent';
const LABEL_CLASSES = 'block font-body text-label font-semibold uppercase tracking-wide text-secondary';

function parseMmSs(value: string): number | null {
  const match = value.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

type Interest = Discipline | 'mix';

interface Props {
  onComplete: (blockId: string) => void;
  showWelcome?: boolean;
}

export default function OnboardingWizard({ onComplete, showWelcome = false }: Props) {
  const [step, setStep] = useState(showWelcome ? 0 : 1);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [mixDisciplines, setMixDisciplines] = useState<Discipline[]>([]);
  const [levels, setLevels] = useState<Partial<Record<Discipline, Level>>>({});
  const [eventDiscipline, setEventDiscipline] = useState<Discipline | null>(null);
  const [eventLabel, setEventLabel] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('time');
  const [goalTime, setGoalTime] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [baselineSource, setBaselineSource] = useState<BaselineSource>('unknown');
  const [baselineTime, setBaselineTime] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [otherTraining, setOtherTraining] = useState<OtherTraining[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDisciplines: Discipline[] =
    interest === 'mix' ? mixDisciplines : interest ? [interest] : [];
  const eventListDiscipline: Discipline =
    interest === 'mix'
      ? eventDiscipline ?? mixDisciplines[0] ?? DEFAULT_DISCIPLINE
      : interest ?? DEFAULT_DISCIPLINE;
  const primaryConfig = disciplineConfig(eventListDiscipline);
  const shownEvents = primaryConfig.events;
  // Lifting / Sports have no event list, and "General fitness" opts out of one:
  // both ask for a weekly time budget instead of an event + goal time.
  const showWeeklyBudget = !primaryConfig.raceable || isGeneralFitnessEvent(eventLabel);

  const goalTimeSeconds = parseMmSs(goalTime);
  const baselineTimeSeconds = parseMmSs(baselineTime);
  const weeklyHoursValue = parseFloat(weeklyHours);
  const weeklyHoursValid = Number.isFinite(weeklyHoursValue) && weeklyHoursValue > 0;

  const step1Valid =
    interest !== null &&
    (interest !== 'mix' || mixDisciplines.length >= 2) &&
    (interest !== 'sports' || selectedSports.length >= 1);
  const step2Valid =
    selectedDisciplines.length > 0 && selectedDisciplines.every((d) => levels[d] != null);
  const step3Valid = showWeeklyBudget
    ? weeklyHoursValid
    : eventLabel !== '' && (goalType !== 'time' || goalTimeSeconds !== null);
  const step4Valid = targetDate !== '';
  const step5Valid = showWeeklyBudget || baselineSource === 'unknown' || baselineTimeSeconds !== null;

  const pickInterest = (d: Discipline) => {
    setInterest(d);
    setEventDiscipline(d);
    setEventLabel(DISCIPLINES[d].events[0]?.label ?? '');
    setLevels({});
    setSelectedSports([]);
  };

  const pickMix = () => {
    setInterest('mix');
    setEventDiscipline(null);
    setEventLabel('');
    setLevels({});
    setSelectedSports([]);
  };

  const toggleSport = (name: string) => {
    setSelectedSports((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  const toggleMixDiscipline = (d: Discipline) => {
    setMixDisciplines((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const changeEventDiscipline = (d: Discipline) => {
    setEventDiscipline(d);
    setEventLabel(DISCIPLINES[d].events[0]?.label ?? '');
  };

  const toggleOtherTraining = (option: OtherTraining) => {
    setOtherTraining((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  };

  // Leaving the level step: make sure the event step has a concrete
  // discipline + event to show (a Mix block hasn't chosen one yet).
  const goToEventStep = () => {
    const d = interest === 'mix' ? eventDiscipline ?? mixDisciplines[0] ?? DEFAULT_DISCIPLINE : eventListDiscipline;
    setEventDiscipline(d);
    if (!DISCIPLINES[d].events.some((e) => e.label === eventLabel)) {
      setEventLabel(DISCIPLINES[d].events[0]?.label ?? '');
    }
    setStep(3);
  };

  const handleFinish = async () => {
    // Guards against a double-click (or a slow render re-firing the handler)
    // creating two blocks — startNewBlock alone only guarantees one *active*
    // block, not that a second call can't run at all.
    if (isSubmitting) return;
    setIsSubmitting(true);

    const primaryDiscipline = eventListDiscipline;
    const cfg = disciplineConfig(primaryDiscipline);
    const chosenEvent = cfg.events.find((e) => e.label === eventLabel);
    const budgetOnly = !cfg.raceable || !chosenEvent || chosenEvent.distanceMeters === null;
    const eventDistanceMeters = budgetOnly ? 0 : (chosenEvent!.distanceMeters as number);
    const sports = primaryDiscipline === 'sports' ? selectedSports : [];
    // Race sports keep the picked event label; budget-only disciplines store a
    // readable stand-in so the goal card has something to show.
    const resolvedEventLabel = cfg.raceable
      ? eventLabel
      : sports.length > 0
        ? sports.join(', ')
        : cfg.label;

    await saveAthlete(daysPerWeek, otherTraining);
    const block = await startNewBlock({
      eventDistanceMeters,
      eventLabel: resolvedEventLabel,
      goalType: budgetOnly ? 'consistency' : goalType,
      goalTimeSeconds: !budgetOnly && goalType === 'time' ? goalTimeSeconds : null,
      targetDate,
      baselineSource: budgetOnly ? 'unknown' : baselineSource,
      raceMantra: null,
      targetSplitSecondsPerKm: null,
      discipline: primaryDiscipline,
      level: levels[primaryDiscipline] ?? null,
      disciplines: selectedDisciplines,
      disciplineLevels: levels,
      weeklyHours: budgetOnly && weeklyHoursValid ? weeklyHoursValue : null,
      sports: sports.length > 0 ? sports : null,
    });

    if (!budgetOnly && baselineSource !== 'unknown') {
      if (baselineTimeSeconds !== null) {
        await addTimedEffort({
          blockId: block.id,
          date: todayIso(),
          distanceMeters: eventDistanceMeters,
          timeSeconds: baselineTimeSeconds,
          kind: 'baseline',
        });
      }
    } else if (!budgetOnly) {
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

  const onFinishClick = () => {
    handleFinish().catch((err) => {
      console.error('onboarding finish failed', err);
      setIsSubmitting(false);
    });
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
          <p className={LABEL_CLASSES}>What are your athletic interests?</p>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="athletic interest">
            {DISCIPLINE_LIST.map((d) => {
              const Icon = d.icon;
              const selected = interest === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={d.label}
                  onClick={() => pickInterest(d.id)}
                  className={`pressable flex flex-col items-center gap-2 rounded-card border p-5 transition-colors ${
                    selected ? 'border-accent bg-accent/10' : 'border-border-strong bg-surface hover:border-accent/40'
                  }`}
                >
                  <Icon className="h-6 w-6 text-primary" />
                  <span className="font-body text-body font-semibold text-primary">{d.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={interest === 'mix'}
              aria-label="Mix / all of the above"
              onClick={pickMix}
              className={`pressable col-span-2 flex items-center justify-center gap-2 rounded-card border p-4 transition-colors ${
                interest === 'mix' ? 'border-accent bg-accent/10' : 'border-border-strong bg-surface hover:border-accent/40'
              }`}
            >
              <Shuffle className="h-5 w-5 text-primary" />
              <span className="font-body text-body font-semibold text-primary">Mix / all of the above</span>
            </button>
          </div>

          {interest === 'mix' && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className={LABEL_CLASSES}>Which do you want included?</p>
              {MIX_DISCIPLINE_LIST.map((d) => (
                <label key={d.id} className="flex items-center gap-2 font-body text-body text-primary">
                  <input
                    type="checkbox"
                    aria-label={`include ${d.label}`}
                    checked={mixDisciplines.includes(d.id)}
                    onChange={() => toggleMixDiscipline(d.id)}
                  />
                  {d.label}
                </label>
              ))}
              {mixDisciplines.length < 2 && (
                <p className="font-body text-caption text-caution">Pick at least two.</p>
              )}
            </div>
          )}

          {interest === 'sports' && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className={LABEL_CLASSES}>{DISCIPLINES.sports.subPrompt}</p>
              {DISCIPLINES.sports.subOptionGroups?.map((group, gi) => (
                <div key={gi} className="flex flex-wrap gap-x-4 gap-y-2">
                  {group.map((name) => (
                    <label key={name} className="flex items-center gap-2 font-body text-body text-primary">
                      <input
                        type="checkbox"
                        aria-label={name}
                        checked={selectedSports.includes(name)}
                        onChange={() => toggleSport(name)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              ))}
              {selectedSports.length === 0 && (
                <p className="font-body text-caption text-caution">Pick at least one.</p>
              )}
            </div>
          )}

          <Button disabled={!step1Valid} onClick={() => setStep(2)} className="w-full">Next</Button>
        </Card>
      )}

      {step === 2 && (
        <Card as="fieldset" className="space-y-5">
          <p className={LABEL_CLASSES}>
            {selectedDisciplines.length === 1
              ? `What's your level in ${DISCIPLINES[selectedDisciplines[0]].label}?`
              : "What's your level in each?"}
          </p>
          {interest === 'sports' && selectedSports.length > 0 && (
            <p className="font-body text-caption text-secondary">{selectedSports.join(', ')}</p>
          )}
          {selectedDisciplines.map((d) => (
            <div key={d} className="space-y-2">
              {selectedDisciplines.length > 1 && (
                <p className="font-body text-caption font-semibold uppercase tracking-wide text-faint">
                  {DISCIPLINES[d].label}
                </p>
              )}
              <div className="space-y-2" role="radiogroup" aria-label={`${DISCIPLINES[d].label} level`}>
                {LEVELS.map((l) => {
                  const selected = levels[d] === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${DISCIPLINES[d].label} ${levelLabel(l)}`}
                      onClick={() => setLevels((prev) => ({ ...prev, [d]: l }))}
                      className={`pressable block w-full rounded-control border p-3 text-left transition-colors ${
                        selected ? 'border-accent bg-accent/10' : 'border-border-strong bg-surface hover:border-accent/40'
                      }`}
                    >
                      <span className="font-body text-body font-semibold text-primary">{levelLabel(l)}</span>
                      <span className="mt-0.5 block font-body text-caption text-secondary">
                        {DISCIPLINES[d].levelDescriptions[l]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <Button disabled={!step2Valid} onClick={goToEventStep} className="w-full">Next</Button>
        </Card>
      )}

      {step === 3 && (
        <Card as="fieldset" className="space-y-4">
          {interest === 'mix' && (
            <label className={LABEL_CLASSES}>
              Discipline for this goal
              <select
                aria-label="event discipline"
                value={eventListDiscipline}
                onChange={(e) => changeEventDiscipline(e.target.value as Discipline)}
                className={FIELD_CLASSES}
              >
                {mixDisciplines.map((d) => (
                  <option key={d} value={d}>{DISCIPLINES[d].label}</option>
                ))}
              </select>
            </label>
          )}
          {primaryConfig.raceable && (
            <label className={LABEL_CLASSES}>
              Event
              <select aria-label="event" value={eventLabel} onChange={(e) => setEventLabel(e.target.value)} className={FIELD_CLASSES}>
                {shownEvents.map((ev) => <option key={ev.label} value={ev.label}>{ev.label}</option>)}
              </select>
            </label>
          )}

          {showWeeklyBudget ? (
            <label className={LABEL_CLASSES}>
              Weekly time budget (hours)
              <input
                aria-label="weekly hours"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
                placeholder="4"
                inputMode="decimal"
                className={FIELD_CLASSES}
              />
              {weeklyHours !== '' && !weeklyHoursValid && (
                <p className="mt-1 font-body text-caption text-caution">Enter hours per week, e.g. 4</p>
              )}
            </label>
          ) : (
            <>
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
            </>
          )}
          <Button disabled={!step3Valid} onClick={() => setStep(4)} className="w-full">Next</Button>
        </Card>
      )}

      {step === 4 && (
        <Card as="fieldset" className="space-y-4">
          <label className={LABEL_CLASSES}>
            Target date
            <input aria-label="target date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={FIELD_CLASSES} />
          </label>
          <Button disabled={!step4Valid} onClick={() => setStep(5)} className="w-full">Next</Button>
        </Card>
      )}

      {step === 5 && (
        <Card as="fieldset" className="space-y-4">
          {showWeeklyBudget ? (
            <p className="font-body text-body text-secondary">
              No baseline test needed here -- we'll track your weekly consistency instead.
            </p>
          ) : (
            <>
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
            </>
          )}
          <Button disabled={!step5Valid} onClick={() => setStep(6)} className="w-full">Next</Button>
        </Card>
      )}

      {step === 6 && (
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
          <Button onClick={onFinishClick} disabled={isSubmitting} className="w-full">Finish</Button>
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
