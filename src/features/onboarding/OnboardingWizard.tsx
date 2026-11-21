import { useState } from 'react';
import { ChevronLeft, Shuffle } from 'lucide-react';
import type { GoalType, BaselineSource, OtherTraining, TrainingBlock, Weekday, UnitSystem } from '../../db/schema';
import {
  DISCIPLINES,
  DISCIPLINE_LIST,
  MIX_DISCIPLINE_LIST,
  DEFAULT_DISCIPLINE,
  LEVELS,
  disciplineConfig,
  disciplineLabel,
  isGeneralFitnessEvent,
  levelLabel,
  type Discipline,
  type Level,
} from '../../lib/disciplines';
import { saveAthlete, startNewBlock, addTimedEffort, createPrescribedSessions } from '../../db/repository';
import { todayIso } from '../../lib/dates';
import { generatePlan, type PrescribedSessionDraft } from '../../lib/plan/generate';
import { defaultTrainingWeekdays } from '../../lib/plan/weekdays';
import { daysBetweenIso } from '../../lib/plan/dateUtils';
import Button from '../../components/Button';
import Card from '../../components/Card';
import SessionTypeIcon, { sessionTypeLabel } from '../../components/SessionTypeIcon';
import { formatMmSs } from '../../lib/format';

const OTHER_TRAINING_OPTIONS: OtherTraining[] = ['lifting', 'sport', 'classes', 'none'];
const QUESTION_COUNT = 6;

const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

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
  const [trainingWeekdays, setTrainingWeekdays] = useState<Weekday[]>(() => defaultTrainingWeekdays(3));
  const [otherTrainingWeekdays, setOtherTrainingWeekdays] = useState<Weekday[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [otherTraining, setOtherTraining] = useState<OtherTraining[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Full generated plan, computed on "Finish" and shown as a preview before
  // anything is persisted -- see handlePreview/handleConfirm.
  const [planDrafts, setPlanDrafts] = useState<PrescribedSessionDraft[] | null>(null);

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
  const step6Valid = trainingWeekdays.length >= 1;

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

  const toggleTrainingWeekday = (day: Weekday) => {
    setTrainingWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const toggleOtherTrainingWeekday = (day: Weekday) => {
    setOtherTrainingWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
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

  // Shared by the preview (a throwaway id/createdAt/status -- never
  // persisted) and handleConfirm (the real startNewBlock call) so both
  // see exactly the same goal/event/discipline shape.
  const buildBlockFields = () => {
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

    return {
      primaryDiscipline,
      budgetOnly,
      eventDistanceMeters,
      fields: {
        eventDistanceMeters,
        eventLabel: resolvedEventLabel,
        goalType: budgetOnly ? 'consistency' as GoalType : goalType,
        goalTimeSeconds: !budgetOnly && goalType === 'time' ? goalTimeSeconds : null,
        targetDate,
        baselineSource: budgetOnly ? ('unknown' as BaselineSource) : baselineSource,
        raceMantra: null,
        targetSplitSecondsPerKm: null,
        discipline: primaryDiscipline,
        level: levels[primaryDiscipline] ?? null,
        disciplines: selectedDisciplines,
        disciplineLevels: levels,
        weeklyHours: budgetOnly && weeklyHoursValid ? weeklyHoursValue : null,
        sports: sports.length > 0 ? sports : null,
      },
    };
  };

  const athleteInput = () => ({
    id: 1 as const,
    daysPerWeek: trainingWeekdays.length,
    otherTraining,
    trainingWeekdays,
    otherTrainingWeekdays,
    unitSystem,
  });

  // Generates the plan for a given (not-yet-persisted) block, used both for
  // the preview and -- again, with the real block.id -- for what actually
  // gets saved on Confirm.
  const generateFor = (block: TrainingBlock) => {
    const { primaryDiscipline, budgetOnly, eventDistanceMeters } = buildBlockFields();
    const baselines =
      !budgetOnly && baselineSource !== 'unknown' && baselineTimeSeconds !== null
        ? {
            [primaryDiscipline]: {
              id: 'preview', blockId: block.id, date: todayIso(),
              distanceMeters: eventDistanceMeters, timeSeconds: baselineTimeSeconds, kind: 'baseline' as const,
            },
          }
        : {};
    return generatePlan({ today: todayIso(), block, athlete: athleteInput(), baselines, fixedSessions: [] });
  };

  const handlePreview = () => {
    const { fields } = buildBlockFields();
    const placeholderBlock: TrainingBlock = { ...fields, id: 'preview', createdAt: '', status: 'active' };
    setPlanDrafts(generateFor(placeholderBlock));
    setStep(7);
  };

  const handleConfirm = async () => {
    // Guards against a double-click (or a slow render re-firing the handler)
    // creating two blocks — startNewBlock alone only guarantees one *active*
    // block, not that a second call can't run at all.
    if (isSubmitting) return;
    setIsSubmitting(true);

    const { budgetOnly, eventDistanceMeters, fields } = buildBlockFields();
    await saveAthlete(athleteInput());
    const block = await startNewBlock(fields);

    if (!budgetOnly && baselineSource !== 'unknown' && baselineTimeSeconds !== null) {
      await addTimedEffort({
        blockId: block.id,
        date: todayIso(),
        distanceMeters: eventDistanceMeters,
        timeSeconds: baselineTimeSeconds,
        kind: 'baseline',
      });
    }

    // Regenerated (not reused from the preview) so every draft carries the
    // block's real id -- generatePlan is pure/deterministic, so this
    // produces the exact same plan the preview showed.
    const finalDrafts = generateFor(block);
    if (finalDrafts.length > 0) await createPrescribedSessions(finalDrafts);

    onComplete(block.id);
  };

  const onConfirmClick = () => {
    handleConfirm().catch((err) => {
      console.error('onboarding confirm failed', err);
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
      {step <= QUESTION_COUNT && (
        <WizardHeader step={step} onBack={() => setStep(step - 1)} showBack={step > 1 || showWelcome} />
      )}

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
        <Card as="fieldset" className="space-y-5">
          <div>
            <p className={LABEL_CLASSES}>Which days can you train?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map(({ value, label }) => {
                const selected = trainingWeekdays.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`train on ${label}`}
                    onClick={() => toggleTrainingWeekday(value)}
                    className={`pressable rounded-control border px-3 py-2 font-body text-body font-semibold transition-colors ${
                      selected ? 'border-accent bg-accent/10 text-primary' : 'border-border-strong bg-surface text-secondary hover:border-accent/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {trainingWeekdays.length === 0 && (
              <p className="mt-1 font-body text-caption text-caution">Pick at least one day.</p>
            )}
          </div>

          <div>
            <p className={LABEL_CLASSES}>Any of those also a lifting or sport day?</p>
            <p className="mt-0.5 font-body text-caption text-secondary">
              We'll keep the hard cardio sessions off these -- an easy one is still fine.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.filter((o) => trainingWeekdays.includes(o.value)).map(({ value, label }) => {
                const selected = otherTrainingWeekdays.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`lift or sport on ${label}`}
                    onClick={() => toggleOtherTrainingWeekday(value)}
                    className={`pressable rounded-control border px-3 py-2 font-body text-body font-semibold transition-colors ${
                      selected ? 'border-accent bg-accent/10 text-primary' : 'border-border-strong bg-surface text-secondary hover:border-accent/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className={LABEL_CLASSES}>
            Units
            <select aria-label="units" value={unitSystem} onChange={(e) => setUnitSystem(e.target.value as UnitSystem)} className={FIELD_CLASSES}>
              <option value="metric">Kilometers</option>
              <option value="imperial">Miles</option>
            </select>
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
          <Button disabled={!step6Valid} onClick={handlePreview} className="w-full">Preview my plan</Button>
        </Card>
      )}

      {step === 7 && planDrafts && (
        <PlanPreview
          drafts={planDrafts}
          isSubmitting={isSubmitting}
          onBack={() => setStep(6)}
          onConfirm={onConfirmClick}
        />
      )}
    </div>
  );
}

function PlanPreview({
  drafts,
  isSubmitting,
  onBack,
  onConfirm,
}: {
  drafts: PrescribedSessionDraft[];
  isSubmitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const today = todayIso();
  const firstTwoWeeks = drafts.filter((d) => daysBetweenIso(today, d.date) < 14).sort((a, b) => (a.date < b.date ? -1 : 1));
  const byWeek: PrescribedSessionDraft[][] = [[], []];
  for (const d of firstTwoWeeks) {
    byWeek[daysBetweenIso(today, d.date) < 7 ? 0 : 1].push(d);
  }
  const isMix = new Set(drafts.map((d) => d.discipline)).size > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="back" className="pressable text-secondary">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-display text-title text-primary">Here's your plan</p>
      </div>
      <p className="font-body text-body text-secondary">
        The first two weeks, so you can see what training actually looks like before we save anything.
        {drafts.length > firstTwoWeeks.length && ` The full plan runs ${drafts.length} sessions through your target date.`}
      </p>

      {byWeek.map((week, wi) =>
        week.length === 0 ? null : (
          <Card key={wi} className="space-y-3">
            <p className="font-body text-label font-bold uppercase tracking-wide text-secondary">Week {wi + 1}</p>
            <div className="space-y-2">
              {week.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <SessionTypeIcon type={s.type} className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-body font-semibold text-primary">
                      {sessionTypeLabel(s.type)}
                      {isMix && <span className="ml-2 font-body text-caption text-faint">{disciplineLabel(s.discipline)}</span>}
                      <span className="ml-2 font-body text-caption text-secondary">
                        {Math.round((s.targetDurationSeconds ?? 0) / 60)} min
                        {s.targetPaceSecondsPerKm != null && ` @ ${formatMmSs(s.targetPaceSecondsPerKm)}/km`}
                      </span>
                    </p>
                    {s.note && <p className="font-body text-caption text-secondary">{s.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      )}

      <Button onClick={onConfirm} disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Building your plan…' : 'Confirm and start'}
      </Button>
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
