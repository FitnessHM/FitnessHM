import { Bike, Dumbbell, Footprints, PersonStanding, Sailboat, Trophy, Waves, type LucideIcon } from 'lucide-react';

// Single source of truth for every athletic discipline onboarding and the
// dashboard know about. Add a discipline here -- its events, per-level
// descriptions, icon, and distance hint -- and the wizard, the goal card, and
// the session logger pick it up without any UI-code changes.

export type Discipline = 'running' | 'cycling' | 'swimming' | 'rowing' | 'lifting' | 'sports' | 'walking';
export type Level = 'beginner' | 'intermediate' | 'advanced' | 'competitive';

export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced', 'competitive'];

// The one event label that means "no race, just a weekly time budget".
export const GENERAL_FITNESS_LABEL = 'General fitness';

export interface DisciplineEvent {
  label: string;
  // null == General fitness: no race distance, uses weeklyHours instead.
  distanceMeters: number | null;
}

export interface DisciplineConfig {
  id: Discipline;
  label: string;
  icon: LucideIcon;
  // false == not a race sport: onboarding skips the event list and the
  // baseline test and just asks for a weekly time budget.
  raceable: boolean;
  // Shown under the Distance field on the Log-a-session screen. Storage is
  // always meters; this only tells the user what unit feels natural.
  distanceHint: string;
  events: DisciplineEvent[];
  levelDescriptions: Record<Level, string>;
  // Only set for disciplines that need a follow-up multi-select on the first
  // screen (Sports -> "which sports?").
  subPrompt?: string;
  subOptionGroups?: string[][];
}

export const DISCIPLINES: Record<Discipline, DisciplineConfig> = {
  running: {
    id: 'running',
    label: 'Running',
    icon: Footprints,
    raceable: true,
    distanceHint: 'Meters — roughly 1,609 per mile, 1,000 per km.',
    events: [
      { label: '5K', distanceMeters: 5000 },
      { label: '10K', distanceMeters: 10000 },
      { label: 'Half Marathon', distanceMeters: 21097.5 },
      { label: 'Marathon', distanceMeters: 42195 },
      { label: GENERAL_FITNESS_LABEL, distanceMeters: null },
    ],
    levelDescriptions: {
      beginner: 'Can run 10-15 min continuously, little or no structured training',
      intermediate: 'Running 3-4x a week, comfortable with a 30-45 min run',
      advanced: 'Running 30+ miles/week with regular workouts',
      competitive: 'Racing regularly off 45+ miles/week and structured build-ups',
    },
  },
  cycling: {
    id: 'cycling',
    label: 'Cycling',
    icon: Bike,
    raceable: true,
    distanceHint: 'Meters — roughly 1,609 per mile, 1,000 per km.',
    events: [
      { label: 'Century (100 mi)', distanceMeters: 160934 },
      { label: 'Gran Fondo', distanceMeters: 120000 },
      { label: 'Time trial', distanceMeters: 40000 },
      { label: GENERAL_FITNESS_LABEL, distanceMeters: null },
    ],
    levelDescriptions: {
      beginner: 'Ride occasionally on flat ground, up to about 30-45 min',
      intermediate: 'Ride 2-3x a week, comfortable with 1-2 hour rides',
      advanced: 'Riding 6+ hours a week with intervals and long weekend rides',
      competitive: 'Training to power targets 10+ hours a week, racing or close to it',
    },
  },
  swimming: {
    id: 'swimming',
    label: 'Swimming',
    icon: Waves,
    raceable: true,
    distanceHint: 'Meters — pool lengths are usually 25 or 50.',
    events: [
      { label: '1500m', distanceMeters: 1500 },
      { label: 'Open water (1-5K)', distanceMeters: 3000 },
      { label: 'Triathlon swim leg', distanceMeters: 1500 },
      { label: GENERAL_FITNESS_LABEL, distanceMeters: null },
    ],
    levelDescriptions: {
      beginner: 'Can swim a few laps but need rest between them',
      intermediate: 'Swim 1-2x a week, can cover 1,000-1,500m with short breaks',
      advanced: 'Swimming 3+x a week, comfortable with 2,500m+ sets',
      competitive: 'Masters or squad training to pace intervals, 4+x a week',
    },
  },
  rowing: {
    id: 'rowing',
    label: 'Rowing',
    icon: Sailboat,
    raceable: true,
    distanceHint: 'Meters — standard erg pieces are 2,000 and 5,000.',
    events: [
      { label: '2K erg', distanceMeters: 2000 },
      { label: '5K erg', distanceMeters: 5000 },
      { label: GENERAL_FITNESS_LABEL, distanceMeters: null },
    ],
    levelDescriptions: {
      beginner: 'New to the erg, can row 5-10 min at a steady rate',
      intermediate: 'Row 2-3x a week, comfortable with 20-30 min steady pieces',
      advanced: 'Rowing 4+x a week with intervals and a known 2K split',
      competitive: 'Training to race 2K, structured pieces 5+x a week',
    },
  },
  lifting: {
    id: 'lifting',
    label: 'Lifting',
    icon: Dumbbell,
    raceable: false,
    distanceHint: 'Meters — most lifting sessions are tracked by duration; leave blank if so.',
    events: [],
    levelDescriptions: {
      beginner: 'New to structured lifting, or lifting occasionally without a program',
      intermediate: 'Lifting 2-3x a week on a program, confident with the main lifts',
      advanced: 'Lifting 4+x a week with periodized programming',
      competitive: 'Training for meets (powerlifting, weightlifting, strongman)',
    },
  },
  sports: {
    id: 'sports',
    label: 'Sports',
    icon: Trophy,
    raceable: false,
    distanceHint: 'Meters — most sport sessions are tracked by duration; leave blank if so.',
    events: [],
    levelDescriptions: {
      beginner: 'Play casually or just getting into it',
      intermediate: 'Play regularly, 1-2 organized sessions or games a week',
      advanced: 'Compete in a league or club with structured training',
      competitive: 'Train and compete at a high level (varsity, elite club, semi-pro+)',
    },
    subPrompt: 'Which sports?',
    subOptionGroups: [
      ['Soccer', 'Basketball', 'Hockey', 'Lacrosse', 'Rugby', 'Football'],
      ['Tennis', 'Squash', 'Racquetball', 'Badminton', 'Pickleball', 'Table tennis'],
      ['Handball', 'Volleyball', 'Ultimate frisbee'],
      ['Wrestling', 'Boxing', 'MMA', 'Kickboxing', 'Muay Thai', 'BJJ'],
      ['Fencing', 'Rock climbing', 'Bouldering'],
      ['Water polo'],
    ],
  },
  walking: {
    id: 'walking',
    label: 'Walking',
    icon: PersonStanding,
    raceable: false,
    distanceHint: 'Meters — roughly 1,609 per mile, 1,000 per km.',
    events: [],
    levelDescriptions: {
      beginner: 'Getting started, or walking for less than 15 min at a time',
      intermediate: 'Walking most days, comfortable with 30-45 min',
      advanced: 'Walking 5+ hours a week, brisk pace or hilly routes',
      competitive: 'Training for distance events or race walking',
    },
  },
};

export const DISCIPLINE_LIST: DisciplineConfig[] = Object.values(DISCIPLINES);
export const DEFAULT_DISCIPLINE: Discipline = 'running';

// "Mix / all of the above" only combines race sports -- Lifting and Sports run
// through the no-event budget path, which doesn't compose with a mixed race
// goal.
export const MIX_DISCIPLINE_LIST: DisciplineConfig[] = DISCIPLINE_LIST.filter((d) => d.raceable);

// Saved blocks from before disciplines existed have no `discipline` -- treat
// them as Running everywhere rather than special-casing each call site.
export function disciplineConfig(id: Discipline | null | undefined): DisciplineConfig {
  return DISCIPLINES[id ?? DEFAULT_DISCIPLINE] ?? DISCIPLINES[DEFAULT_DISCIPLINE];
}

export function disciplineLabel(id: Discipline | null | undefined): string {
  return disciplineConfig(id).label;
}

export function levelLabel(level: Level | null | undefined): string {
  return level ? level.charAt(0).toUpperCase() + level.slice(1) : '';
}

export function isGeneralFitnessEvent(eventLabel: string | null | undefined): boolean {
  return eventLabel === GENERAL_FITNESS_LABEL;
}
