# FitnessHM — Phase 1: Foundation Design

Date: 2026-08-30
Status: Approved for planning

## Context

FitnessHM is a running training app built around a **training block**: a
goal, a target date, and checkpoint tests in between. The full product spec
(onboarding, dashboard, pace math, workout library/scheduler, plan generator,
session logger, recovery gating, conditions guard, niggle tracker, race week
module) is too large for one implementation pass. This document scopes
**Phase 1 only**: the foundation everything else builds on.

## Phasing

| Phase | Scope |
|---|---|
| **1 (this doc)** | Data model, onboarding, Block Dashboard, Session Logger, Pace Math |
| 2 | Workout Library + week-view Scheduler + Plan Generator |
| 3 | Recovery Gating (rules engine) + Conditions Guard (weather) |
| 4 | Niggle Tracker + Race Week Module |

Each phase gets its own spec, implementation plan, and PR. Phase 1 must be
fully usable end-to-end on its own: a user can create a block, see the
dashboard, and log sessions, even though nothing schedules those sessions for
them yet (phase 1 ships a small hand-seeded set of prescribed sessions so the
logger has something real to log against).

## Goals

- Local-first, no-account, installable PWA.
- Data model that phases 2-4 extend without breaking changes.
- Dashboard gives an honest, numeric feasibility read on the goal.
- Session logger treats partial completion as a normal, non-judged outcome.
- Wearable/GPS import is a real interface today, even with only one
  (manual-entry) implementation.

## Non-goals (phase 1)

- No plan generator, no scheduler, no workout library UI.
- No recovery gating rules, no weather integration.
- No niggle tracking, no race week module.
- No real wearable integrations (WHOOP/Garmin/Strava/Apple Health) — interface
  only.
- No sync/backend/auth of any kind.

## Architecture & Stack

- **React 19 + TypeScript + Vite**. `vite-plugin-pwa` for offline/installable
  behavior.
- **Storage**: Dexie (IndexedDB). The relational shape (block → efforts →
  sessions → logs) outgrows `localStorage`; Dexie gives typed tables, indexes,
  and reactive queries (`dexie-react-hooks`' `useLiveQuery`) without a heavy
  state library.
- **Styling**: Tailwind CSS. Dark mode is the only theme in phase 1 (per
  spec's "dark mode default"); color tokens are defined as CSS variables so a
  light theme can be added later without a rewrite. Large tap targets,
  high-contrast palette, mobile-first (usable one-handed at a track).
- **Charts**: Recharts, for the progression chart on the dashboard.
- **State**: no Redux/Zustand. Dexie is the single source of truth; components
  read via `useLiveQuery` hooks and write via a small `db/` module of typed
  functions (`createBlock`, `logSession`, etc.). This keeps state management
  boring and testable as plain functions.
- **Routing**: React Router — routes for `/onboarding`, `/dashboard`,
  `/log/:sessionId?`.
- **Hosting**: static build, deployable to GitHub Pages. No server component.

## Data Model

All entities live in one Dexie database (`fitnesshm`). TypeScript shapes:

```ts
type GoalType = 'time' | 'finish' | 'consistency';
type OtherTraining = 'lifting' | 'sport' | 'classes' | 'none';
type SessionType =
  | 'easy' | 'long_run' | 'tempo' | 'threshold' | 'vo2max'
  | 'reps_short' | 'reps_800' | 'fartlek' | 'hills' | 'strides'
  | 'time_trial' | 'cross_training' | 'rest';
type CutShortReason = 'heat' | 'fatigue' | 'pain' | 'time' | 'life';
type EffortKind = 'baseline' | 'checkpoint' | 'race';
type BaselineSource = 'known' | 'estimate' | 'unknown';

interface Athlete {
  id: 1; // singleton
  daysPerWeek: number;
  otherTraining: OtherTraining[];
}

interface TrainingBlock {
  id: string;
  eventDistanceMeters: number;   // e.g. 5000, 21097.5
  eventLabel: string;            // "5K", "Half Marathon", "Mile"
  goalType: GoalType;
  goalTimeSeconds: number | null; // null if goalType != 'time'
  targetDate: string;             // ISO date
  baselineSource: BaselineSource;
  createdAt: string;
}

interface TimedEffort {
  id: string;
  blockId: string;
  date: string;
  distanceMeters: number;
  timeSeconds: number;
  kind: EffortKind;
}

interface PrescribedSession {
  id: string;
  blockId: string;
  date: string;
  type: SessionType;
  reps: number | null;
  targetPaceSecondsPerKm: number | null;
  targetRestSeconds: number | null;
  targetDurationSeconds: number | null;
  note: string | null;           // "why" line shown to the user
}

interface SessionLog {
  id: string;
  sessionId: string | null;      // null = adhoc log, no prescribed session
  blockId: string;
  date: string;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  recoveryScore: number | null;  // 1-5, optional
  sleepHours: number | null;     // optional
  temperatureC: number | null;   // optional
  rpe: number | null;            // 1-10, optional
  note: string | null;
  cutShortReason: CutShortReason | null;
}
```

Indexes: `TimedEffort.blockId+date`, `PrescribedSession.blockId+date`,
`SessionLog.blockId+date`, `SessionLog.sessionId`.

### Wearable adapter interface

```ts
interface Activity {
  date: string;
  distanceMeters: number;
  durationSeconds: number;
  avgHeartRate: number | null;
  source: string; // adapter name
}

interface WearableAdapter {
  name: string;
  fetchActivities(range: { start: string; end: string }): Promise<Activity[]>;
}
```

Phase 1 ships one implementation, `ManualEntryAdapter`, whose
`fetchActivities` returns `[]` (there is nothing to "fetch" — entry is
manual). Its purpose is to prove the interface shape now so WHOOP/Garmin/
Strava/Apple Health adapters can be dropped in later without touching the
`SessionLog` schema or the logger UI.

## Onboarding

A 5-step wizard, completable in under 60 seconds, creating one
`TrainingBlock` (+ `Athlete` singleton on first run):

1. Event/distance + goal (time goal, "just finish", or "get consistent")
2. Target date
3. Current baseline: a recent time, an estimate, or "no idea"
4. Days per week available to run
5. Other training happening (multi-select: lifting/sport/classes/none)

If baseline is "no idea", onboarding auto-creates a `PrescribedSession` of
type `time_trial` dated in week 1, and the dashboard's "current best" reads
as "TBD — take your baseline test" until that log exists.

## Block Dashboard

- Goal, target date, days remaining.
- Current best (latest/most relevant `TimedEffort`) vs goal: numeric gap and
  required rate of improvement (e.g., "need to drop 4.2s/km every 2 weeks"),
  computed as a linear interpolation between the current best (or baseline,
  if no checkpoint exists yet) and the goal time over the weeks remaining to
  the target date.
- Progression chart (Recharts line chart) of every `TimedEffort` in the
  block.
- Next scheduled session card (soonest `PrescribedSession` with no
  `SessionLog` yet), front and center.
- Feasibility read: compare required improvement rate against a
  conservative, documented heuristic ceiling (e.g., realistic short-block
  improvement rates by distance, pulled from generally-accepted training
  literature ranges). If the goal exceeds that ceiling, show a plain-language
  warning plus one concrete suggested adjustment (later date or softer time),
  clearly labeled as a heuristic, not a promise.

## Pace Math (pure functions, unit-tested first)

- `paceFromGoal(distanceMeters, goalTimeSeconds) → secondsPerKm` and
  splits (per-lap/km/mile).
- `riegelEquivalent(knownDistance, knownTime, targetDistance, exponent=1.06)`
  for cross-distance race-equivalency.
- `trainingZones(baselineDistance, baselineTime) → { easy, tempo, threshold,
  vo2, rep }` as pace ranges, derived from baseline using standard
  percentage-of-threshold-pace bands.
- User-settable race mantra / split target: a free-text field + a target
  split stored per block, surfaced on race day (no extra entity needed —
  a `raceMantra: string | null` and `targetSplitSecondsPerKm: number | null`
  field on `TrainingBlock`).

## Session Logger

- Pick a `PrescribedSession` (or log adhoc with none selected).
- Actual vs prescribed shown side by side (e.g. "3.5 of 5 × 800m", "26 of 35
  min") — partial completion renders identically to full completion, just
  with the actual numbers; no color-coded pass/fail, no streak/badge UI.
- Optional fields: recovery score, sleep, temperature, RPE, free-text note.
- If actual < prescribed, prompt for `cutShortReason` (heat/fatigue/pain/
  time/life) — optional, never forced.
- A simple reason-count table below the log form (count of each
  `cutShortReason` across the block) — the "surface patterns" requirement,
  kept to a table in phase 1 rather than a chart.

## Seed Data

On first load with an empty database, seed one example `TrainingBlock` (5K,
time goal, ~10 weeks out), 2-3 `TimedEffort` baseline/checkpoint entries, and
a handful of `PrescribedSession`s spanning the first two weeks (easy, tempo,
one long run, one time trial) — enough that the dashboard and logger are
immediately testable without onboarding first.

## Testing

- Vitest + React Testing Library.
- TDD for `pace-math` and `feasibility` modules (pure functions — write
  tests first, per project convention).
- Component tests for the onboarding wizard, dashboard, and logger covering:
  partial-completion rendering (no red/fail styling), adhoc vs prescribed
  logging, feasibility warning trigger threshold, seed data loads correctly.
- Tests and this doc get updated together as phase 1 evolves (per user's
  standing testing convention — update tests + docs on every change, run
  tests before every commit).

## Repo & Deployment

- New public GitHub repo `FitnessHM`, created via `gh repo create` — **only
  after phase 1 code is committed locally and the user confirms**, since
  creating a public repo is a visible-to-others action.
- Static build deployed to GitHub Pages from the repo (no server, no
  secrets, consistent with local-first/no-account).

## Open items carried to later phases

- Realistic-improvement-rate table for the feasibility heuristic should be
  revisited once real user data exists (phase 1 ships reasonable literature-
  based defaults, user-overridable later).
- Training zone percentage bands are a simplification; phase 2+ may want to
  make them user-editable like the recovery-gating rules will be.
