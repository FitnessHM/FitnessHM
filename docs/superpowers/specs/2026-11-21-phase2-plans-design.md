# FitnessHM — Phase 2: Plan Generator & Plan Editing (Design)

Date: 2026-11-21
Status: Draft — awaiting approval

## Context

Phase 1 shipped the foundation: data model, onboarding, the home screen, pace
math, and the session logger — for running only, with no plan generator (a
hand-seeded time-trial session was the only thing onboarding ever created).
Onboarding has since grown to collect discipline, level, and a full
multi-discipline/mix model (`src/lib/disciplines.ts`), but nothing downstream
uses most of that: `OnboardingWizard.handleFinish` still only creates a block
plus, at most, one `time_trial` session. The home screen is permanently empty
for every real user.

This phase builds the thing the product is named for: a generated, editable
training plan, for every discipline the onboarding already asks about
(running, cycling, swimming, rowing, walking, or a mix), that reacts to what
the athlete actually logs.

## Verified gaps (confirmed by reading the code, not just the brief)

- `OnboardingWizard.handleFinish` (`src/features/onboarding/OnboardingWizard.tsx:139`)
  creates one block and, if `baselineSource === 'unknown'`, one `time_trial`
  session. Nothing else. No plan ever exists.
- `repository.ts` has no `updatePrescribedSession`, `deletePrescribedSession`,
  `updateBlock`, or bulk-replace function — editing is impossible today.
- `SessionType`, `targetPaceSecondsPerKm` on `PrescribedSession`, and the
  `SessionTypeIcon`/label maps are running-only.
- `server/src/lib/strava.ts::upsertActivityLog` always inserts with
  `sessionId: null` — a synced Strava run never checks off a planned session,
  even when one exists for that day.
- `Athlete.daysPerWeek` (a plain count) and `Athlete.otherTraining` (a
  category list, no weekdays) are collected at onboarding step 6 but never
  read anywhere else in `src/`.
- `SessionLogger.handleSave` (`src/features/logger/SessionLogger.tsx:61`)
  hardcodes `date: todayIso()` — you cannot log yesterday's planned run today.
- `MIX_DISCIPLINE_LIST` filters on `raceable`, which excludes **walking**
  (`raceable: false`) from "Mix / all of the above" even though walking is a
  cardio discipline the rest of the product treats as a first-class option.
  This is a real bug relative to this phase's goal ("picks the cardio they
  want... running, cycling, swimming, rowing, walking, or a mix") and gets
  fixed as part of the data-model commit (see "Discipline categorization
  fix" below).

## Goals

- A deterministic, pure, TDD'd plan generator covering all five cardio
  disciplines and mixes of them, for both race-goal and general-fitness/
  weekly-hours blocks.
- A `PrescribedSession` shape that's genuinely discipline-generic, with
  interval structure, while staying backward compatible with every row ever
  written in Phase 1.
- Full CRUD on sessions and blocks, with sync (`touchMeta`) wired through,
  and a plan screen to drive it.
- Logs — manual or Strava — automatically check off the matching planned
  session.
- Light, explainable, rule-based adaptation: a rough week gets a lighter
  next week; a new time trial updates future targets. No ML, no LLM calls.
- Units shown in the athlete's preference (mi/km, m/yd), stored in meters
  always.

## Non-goals (this phase)

- Garmin or any wearable beyond Strava (already connected in Phase 1's
  follow-on work).
- Weather/recovery gating (Phase 3).
- Niggle tracker, race week module (Phase 4).
- Payments.
- Per-day duration budgets (e.g. "I only have 30 min on Tuesdays") — out of
  scope; the generator works from training *weekdays*, not per-day time
  budgets. Noted as an open item.
- Power-meter/HR-based cycling targets — no HR or power data is collected
  anywhere in this app (no biometric input exists outside Strava's
  distance/duration/time fields), so "HR zone/RPE" for cycling resolves to an
  RPE range plus a descriptive zone label (e.g. "Zone 2 (easy)"), not a
  numeric heart-rate target. Calling this out now so it isn't read as an
  oversight later.
- True interval pyramids/mixed-rep-distance sets — the `steps` structure
  supports one uniform `reps × work + rest` block per session (e.g. "6 ×
  800m @ pace, 90s rest"), not pyramids or multi-set sessions. Documented as
  a v1 scope cut.

## Discipline categorization fix

`DisciplineConfig` currently only has `raceable` (drives the onboarding
event-picker vs. weekly-budget-only branch). This phase adds `cardio:
boolean` — `true` for running/cycling/swimming/rowing/walking, `false` for
lifting/sports. `MIX_DISCIPLINE_LIST` filters on `cardio`, not `raceable`, so
walking can join a Mix. `raceable` is unchanged in meaning: walking stays
weekly-budget-only (no event list, no baseline test) even inside a Mix,
exactly like picking "General fitness" does today for a race-capable
discipline. Lifting and Sports remain outside the generator entirely — they
stay "other training" that the scheduler avoids placing hard cardio on top
of (see Athlete model below), never disciplines the planner generates
sessions for.

## Data model changes

### `src/lib/disciplines.ts`

- Add `cardio: boolean` to `DisciplineConfig`; set it on all seven entries.
- `MIX_DISCIPLINE_LIST = DISCIPLINE_LIST.filter((d) => d.cardio)`.
- New `CARDIO_DISCIPLINES: Discipline[]` export (`running`, `cycling`,
  `swimming`, `rowing`, `walking`) — the set the generator and the
  per-discipline session libraries are indexed by.

### `src/db/schema.ts` (Dexie, bump to version 4)

```ts
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Date#getDay() convention, 0 = Sunday
export type UnitSystem = 'metric' | 'imperial';

export interface Athlete {
  id: 1;
  daysPerWeek: number;                    // kept (back-compat; now derived from trainingWeekdays.length going forward)
  otherTraining: OtherTraining[];          // kept (still drives the onboarding checkbox list)
  // NEW. Specific weekdays available for cardio training. null on athletes
  // who onboarded before this phase — the scheduler falls back to
  // `defaultTrainingWeekdays(daysPerWeek)` (see Generator rules) until they
  // revisit onboarding or Settings.
  trainingWeekdays: Weekday[] | null;
  // NEW. Weekdays already spoken for by lifting/sport — the scheduler never
  // places a hard cardio session on one of these (it may still place an
  // easy one, since a day can be both a training day and an "other
  // training" day).
  otherTrainingWeekdays: Weekday[] | null;
  // NEW. Default 'metric'. Governs display/entry only; storage is always
  // meters (see "Units").
  unitSystem: UnitSystem;
}
```

```ts
// Generalizes across every discipline's session library. Old running types
// are unchanged; see "Per-discipline session libraries" for the full list
// and the new types it adds.
export type SessionType =
  | 'easy' | 'long_run' | 'tempo' | 'threshold' | 'vo2max'
  | 'reps_short' | 'reps_800' | 'fartlek' | 'hills' | 'strides'
  | 'time_trial' | 'cross_training' | 'rest'
  | 'bike_endurance' | 'bike_sweet_spot_threshold' | 'bike_vo2_intervals'
  | 'bike_long_ride' | 'bike_recovery_spin' | 'bike_time_trial'
  | 'swim_technique_drill' | 'swim_aerobic_sets' | 'swim_threshold_css'
  | 'swim_continuous' | 'swim_time_trial'
  | 'row_steady_state' | 'row_threshold_pieces' | 'row_intervals' | 'row_time_trial'
  | 'walk_brisk' | 'walk_long' | 'walk_hills';

export type Intensity = 'easy' | 'moderate' | 'hard';
export type SessionSource = 'generated' | 'user';

// reps × work + rest. One uniform block per session (see Non-goals).
export interface IntervalStep {
  reps: number;
  workSeconds: number | null;   // one of workSeconds/workMeters is set, never both
  workMeters: number | null;
  restSeconds: number;
}

export interface PrescribedSession {
  id: string;
  blockId: string;
  date: string;
  type: SessionType;
  // NEW. Which cardio discipline this session belongs to. Undefined on
  // pre-phase-2 rows; `discipline ?? block.discipline ?? 'running'` is the
  // read-time fallback (same pattern as `TrainingBlock.discipline` today).
  discipline?: Discipline;
  // NEW. Drives the 80/20 and hard-session-cap rules. Undefined rows are
  // read through SESSION_INTENSITY[type] (see Generator rules) rather than
  // defaulted blindly, so old data gets a correct value instead of a guess.
  intensity?: Intensity;
  reps: number | null;               // unchanged meaning for simple rep sessions (e.g. strides); ignored when `steps` is set
  steps: IntervalStep[] | null;      // NEW — structured reps×work+rest; null for continuous/steady sessions
  targetPaceSecondsPerKm: number | null;      // unchanged — running & walking
  targetPaceSecondsPer100m: number | null;    // NEW — swimming
  targetSplitSecondsPer500m: number | null;   // NEW — rowing
  targetZoneLabel: string | null;             // NEW — cycling ("Zone 2", "Sweet spot", "VO2max"), and anyone else with no numeric target
  targetRpeMin: number | null;                // NEW — universal fallback, always set once a baseline-free session is generated
  targetRpeMax: number | null;                // NEW
  targetRestSeconds: number | null;  // unchanged — rest between reps when `steps` is null
  targetDurationSeconds: number | null;  // unchanged — always set; the universal fallback alongside RPE
  targetDistanceMeters: number | null;   // NEW — total session distance target, meters always (long run/ride/swim/row/walk; also the whole-session distance for distance-based sessions)
  note: string | null;               // unchanged — the "why" line
  // NEW. 'generated' unless a human created this session from nothing via
  // "add a session". Distinct from `edited` — a generated session the user
  // then tweaks stays source: 'generated', edited: true.
  source?: SessionSource;
  // NEW. Once true, "Update plan" never touches this session's content or
  // deletes it for being regenerated (it may still be deleted if its date
  // falls after a shortened target date — see "Update plan").
  edited?: boolean;
}
```

`source`/`edited` are optional in the type so existing rows typecheck as-is;
the generator and every write path always sets them going forward, and read
sites treat `undefined` as `source: 'generated', edited: false` (safe
defaults — an old row behaves exactly like a fresh generated one, which is
correct: it was never user-edited).

Dexie v4 upgrade: no data transformation is required (every new field is
optional/undefined-safe), so the upgrade only declares the new version —
existing `sessions`/`athlete` rows are read correctly by the fallbacks above
without a `.upgrade()` migration function. `Athlete.trainingWeekdays` /
`otherTrainingWeekdays` stay `null`, `unitSystem` is read with
`?? 'metric'` at call sites (not backfilled in place, consistent with how
`TrainingBlock.discipline` is already handled).

### Server: `server/src/db/schema.ts` + new drizzle migration (0004)

Mirror the new columns, all nullable (or defaulted) so existing rows need no
backfill:

- `athletes`: `training_weekdays jsonb`, `other_training_weekdays jsonb`,
  `unit_system text not null default 'metric'`.
- `prescribed_sessions`: `discipline text`, `intensity text`, `steps jsonb`,
  `target_pace_seconds_per_100m double precision`,
  `target_split_seconds_per_500m double precision`,
  `target_zone_label text`, `target_rpe_min integer`,
  `target_rpe_max integer`, `target_distance_meters double precision`,
  `source text not null default 'generated'`,
  `edited boolean not null default false`.

Generated via `npm run db:generate` after the schema edit; **not** run
against Neon (`npm run db:migrate`) without asking first, per your standing
instruction.

### `server/src/routes/state.ts` (zod)

- `athleteSchema`: add `trainingWeekdays: z.array(z.number().int().min(0).max(6)).nullish()`,
  `otherTrainingWeekdays: z.array(z.number().int().min(0).max(6)).nullish()`,
  `unitSystem: z.enum(['metric', 'imperial']).nullish()`.
- `sessionSchema.type`: expand the `z.enum([...])` to the full new
  `SessionType` list above — this is the exact bug class called out in the
  brief ("the `z.enum` there will reject new types and silently break
  sync"), so this edit lands in the same commit as the schema change, before
  anything generates a non-running session.
- `sessionSchema`: add `discipline: z.string().nullish()`,
  `intensity: z.enum(['easy', 'moderate', 'hard']).nullish()`,
  `steps: z.array(z.object({ reps: z.number().int(), workSeconds: z.number().nullable(), workMeters: z.number().nullable(), restSeconds: z.number() })).nullish()`,
  `targetPaceSecondsPer100m: z.number().nullish()`,
  `targetSplitSecondsPer500m: z.number().nullish()`,
  `targetZoneLabel: z.string().nullish()`,
  `targetRpeMin: z.number().nullish()`, `targetRpeMax: z.number().nullish()`,
  `targetDistanceMeters: z.number().nullish()`,
  `source: z.enum(['generated', 'user']).nullish()`,
  `edited: z.boolean().nullish()`.
- `blockSchema`: unchanged — training days move to `Athlete`, not `Block`
  (see "Editing the block" below for why that's the right call, not an
  oversight).

## Per-discipline session libraries

Each library is a pure module under `src/lib/plan/library/<discipline>.ts`
exporting the discipline's fixed set of session *kinds* and a function that
turns `{ level, phase, baseline | null, athleteGoal }` into a concrete
session draft (type, intensity, duration/distance, targets, note). Type
names are deliberately literal matches to the library list in the brief —
nothing invented beyond what was asked for.

| Discipline | Types (`SessionType`) | Intensity |
|---|---|---|
| Running | `easy`, `long_run`, `tempo`, `threshold`, `vo2max`, `reps_short`, `reps_800`, `fartlek`, `hills`, `strides`, `time_trial` | easy, easy, moderate, moderate, hard, hard, hard, hard, hard, easy, hard |
| Cycling | `bike_endurance`, `bike_sweet_spot_threshold`, `bike_vo2_intervals`, `bike_long_ride`, `bike_recovery_spin`, `bike_time_trial` | easy, moderate, hard, easy, easy, hard |
| Swimming | `swim_technique_drill`, `swim_aerobic_sets`, `swim_threshold_css`, `swim_continuous`, `swim_time_trial` | easy, easy, moderate, easy, hard |
| Rowing | `row_steady_state`, `row_threshold_pieces`, `row_intervals`, `row_time_trial` | easy, moderate, hard, hard |
| Walking | `walk_brisk`, `walk_long`, `walk_hills` | easy, easy, moderate |
| Shared | `rest`, `cross_training` | n/a (excluded from all intensity counts) |

This table is `SESSION_INTENSITY: Record<SessionType, Intensity>` in
`src/lib/plan/intensity.ts` — used both as the generator's own choice and as
the read-time fallback for pre-phase-2 rows with no `intensity` field. Rowing
has no dedicated "long" type and walking/rowing have no explicit
"recovery"/"technique" type beyond what's listed — the week's longest
session for those disciplines reuses `row_steady_state` / `walk_long` /
`walk_brisk` at a longer duration rather than inventing a type the brief
didn't ask for.

Checkpoint/test session types — used by the matching and retarget logic
(below) to recognize "this log is a baseline/checkpoint test" — are
`time_trial`, `bike_time_trial`, `swim_time_trial`, `row_time_trial`.
Walking has none (it never collects a baseline today, and this phase doesn't
add one — consistent with its existing budget-only onboarding path).

### Targets, in each sport's own terms

Every generated session always sets `targetDurationSeconds` and
`targetRpeMin`/`targetRpeMax` (the universal fallback). On top of that:

- **Running / walking**: `targetPaceSecondsPerKm`, once a baseline/checkpoint
  effort exists for that discipline (via `trainingZonesFromBaseline`,
  extended to take a zone name and discipline — see below). `null` until
  then.
- **Swimming**: `targetPaceSecondsPer100m`, derived the same way from a
  100m-normalized baseline.
- **Rowing**: `targetSplitSecondsPer500m`, derived from a 500m-normalized
  baseline.
- **Cycling**: no pace baseline exists for cycling in this app (no power
  meter, no cycling time trial that produces a comparable number the way a
  run/swim/row time trial does — a bike "time trial" session is prescribed
  as a hard effort, but its *result* isn't fed into a zone model the way
  `addTimedEffort` feeds running). Cycling sessions always carry
  `targetZoneLabel` (e.g. "Zone 2 (easy)", "Sweet spot", "VO2max") plus the
  universal RPE/duration fallback — never a fabricated numeric pace or power
  target.
- **Distance-based long sessions** (long run/ride/swim/row/walk) also set
  `targetDistanceMeters`, converted to the athlete's display units by the UI
  layer only (storage is always meters).
- **Interval sessions** (reps_short, reps_800, vo2max, fartlek on the
  running side; `bike_vo2_intervals`; `row_intervals`) set `steps` and reuse
  `targetPaceSecondsPerKm`/`targetSplitSecondsPer500m`/`targetZoneLabel` as
  the *per-rep* target.

`trainingZonesFromBaseline` (`src/lib/paceMath.ts`) is running/km-shaped
today. This phase generalizes it to
`trainingZonesFromBaseline(baselineDistanceMeters, baselineTimeSeconds, unitDistanceMeters)`
where `unitDistanceMeters` is `1000` for running/walking, `100` for
swimming, `500` for rowing — the existing `ZONE_PACE_PERCENT` table (percent
of threshold pace) is discipline-agnostic and doesn't change; only the
denominator does. Existing call sites (running) pass `1000` and are
unaffected; this is a pure extension, not a breaking change, and gets its
own unit test before any caller changes.

Every generated session keeps a one-line `note` explaining *why* it's there
(e.g. "Builds your aerobic base without adding fatigue.", "Your longest
session this week — capped at 10% over last week's.", "Sharpening before
taper — short and fast, not long."). "Skip"/"no baseline yet" sessions note
that too (e.g. "No baseline yet — paced by feel until your first time
trial.").

## Generator rules

`src/lib/plan/` — pure, deterministic, dependency-free (same convention as
`paceMath.ts`/`feasibility.ts`), TDD'd module-by-module before any UI calls
in:

```
src/lib/plan/
  types.ts        # GeneratorInput, PrescribedSessionDraft, Phase, WeekPlan
  weekdays.ts      # defaultTrainingWeekdays(n), weekday helpers
  phases.ts        # phase breakdown: base/build/specific/taper, or build/deload cycles
  volume.ts         # weekly volume targets, deload weeks, longest-session growth cap
  intensity.ts       # SESSION_INTENSITY table, weekly hard/moderate/easy slot counts
  library/
    running.ts  cycling.ts  swimming.ts  rowing.ts  walking.ts
  schedule.ts    # assigns concrete calendar dates + disciplines to the week's slots
  generate.ts    # generatePlan(input): PrescribedSessionDraft[] — top-level orchestration
  adapt.ts        # matching, fatigue adaptation, checkpoint retarget (see below)
```

Each file gets a co-located `*.test.ts` written first, mirroring
`paceMath.test.ts`/`feasibility.test.ts`. `generate.test.ts` additionally
contains integration-style tests for the four "done means" scenarios
verbatim (12-week intermediate swim 1500m; 5K run with a goal time; 5hr/week
cycling general-fitness; run+bike mix) asserting the output is non-empty,
every session falls on a training weekday, no two hard/moderate days are
adjacent, hard-session-per-week caps hold, and a deload week appears every
3–4 weeks.

### Inputs

```ts
interface GeneratorInput {
  today: string;                             // ISO date
  block: TrainingBlock;                       // discipline(s), level(s), event/goal or weeklyHours, targetDate, baselineSource
  athlete: Athlete;                           // trainingWeekdays, otherTrainingWeekdays
  baselines: Partial<Record<Discipline, TimedEffort>>; // most recent/best effort per discipline, if any
  // Sessions the generator must treat as fixed: dated >= today, and either
  // edited: true or source: 'user'. Empty on a brand-new plan. On "Update
  // plan" this is every such session in the block — the generator counts
  // each one's duration/distance toward its week's volume and its
  // intensity toward that week's hard/moderate-session count, and never
  // places a new session on a date one of them occupies.
  fixedSessions: PrescribedSession[];
}
```

### Phase structure

**Race goals** (a specific event + target date):

1. **Taper length**, scaled to event length. Event length is bucketed by
   *estimated finishing time* (using a level-based assumed pace), not raw
   distance — distance isn't comparable across disciplines, time is:
   - < 40 min estimated: 4 days
   - 40–90 min: 1 week
   - 90 min – 3 hr: 1.5 weeks
   - \> 3 hr (marathon, century, long open-water): 2.5 weeks
2. Weeks remaining after taper split **base 40% / build 35% / specific 25%**
   (rounded, minimum 1 week each when ≥ 3 weeks remain). Fewer than 3 weeks
   remaining after taper: skip straight to all-"specific" — not enough time
   for a real base/build progression, and pretending otherwise would be
   worse than being honest about it.
3. **Base**: mostly easy/aerobic; introduces one moderate session partway
   through. **Build**: highest volume; progressively introduces hard
   intervals. **Specific**: volume plateaus/slightly recedes from the build
   peak; intensity shifts toward race-pace-specific work (tempo/threshold
   trending toward goal pace; swim CSS sets; row threshold pieces; bike
   sweet-spot/threshold). **Taper**: volume drops sharply (~50–60% of peak);
   one short sharpening effort early in taper, easy/rest closer to the
   event; the day(s) immediately before the target date are rest.

**General fitness / weekly-hours goals** (no race, just a time budget or
ongoing consistency): repeating **3 build weeks + 1 deload week** cycles for
the length of the block. Week 1 ramps in at ~80% of `weeklyHours` for
beginners/no-baseline athletes (100% otherwise) to avoid a hard opening
week; the deload week in each cycle runs at ~60–70% of that cycle's build
volume.

**Deload weeks** (both goal types, where not already superseded by taper):
every 3rd–4th week. At most 1 hard session that week (0 for beginners), and
the week's longest session drops to roughly 70% of its recent peak.

### Volume & intensity rules

| Rule | Applies to |
|---|---|
| ~80% of weekly volume easy, ~20% moderate/hard (polarized distribution) | All weeks outside taper |
| Max 2 hard sessions/week (1 for beginners), counted across **all** disciplines combined, not per-discipline | Every week |
| Never two hard-or-moderate ("non-easy") days back-to-back | Every week |
| No hard sessions on an `otherTrainingWeekdays` day | Every week |
| Deload every 3–4 weeks | Every multi-week block |
| Longest session this week ≤ 110% of the max longest-session across the last ≤3 non-deload weeks (seeded from a level-based starting duration in week 1) | Every week outside deload/taper (which instead *shrink*) |

All six rules are **coaching convention, not controlled-research findings**
— see "Rule sources" below for exactly which ones have a real citation
(the 80/20 split) versus which are honestly just widely-used heuristics
(everything else, including the 110%-growth cap, which is a conservative
reading of the popular-but-weakly-supported "10% rule").

### Mix scheduling

Total weekly slots `N = athlete.trainingWeekdays.length` (or
`defaultTrainingWeekdays(athlete.daysPerWeek).length` when `null`). For a
Mix block, slots split across the chosen disciplines with the block's
primary (goal/event) discipline getting the remainder:
`primary = ceil(N / disciplineCount) + remainder`, others
`floor(N / disciplineCount)`, minimum 1 each when `N ≥ disciplineCount`. When
`N < disciplineCount` (fewer training days than chosen disciplines), which
discipline sits out rotates week-to-week by week index, so every discipline
still gets regular sessions over the life of the block rather than one
discipline being silently starved. The hard/moderate/easy and adjacency
rules above apply to the *combined* week across disciplines — two hard
sessions on the same day from different disciplines still violates "no two
hard days back-to-back," because it's the same athlete's recovery, not two.

The week's single "long" session (whichever discipline it falls to that
week) is placed on the latest available training weekday (Saturday
preferred, then Sunday, then whichever is last in `trainingWeekdays`) — this
app doesn't collect which day an athlete actually has more free time, so
"last available day of the week" is a documented placeholder convention,
not a researched choice.

### No-baseline handling

Per discipline: until a `baselines[discipline]` entry exists, every session
for that discipline carries `targetPaceSecondsPerKm`/`Per100m`/`Per500m: null`
and relies on `targetDurationSeconds` + `targetRpeMin/Max` (and, for cycling,
always, `targetZoneLabel`). The moment a checkpoint effort is logged (see
"Checkpoint retarget" below), future generated-and-unedited sessions for
that discipline get real pace/split targets filled in — exactly the
"with no baseline, use time + RPE until a test is logged, then fill in pace
targets" requirement.

## Onboarding changes

`src/features/onboarding/OnboardingWizard.tsx`:

- **New questions**, appended after the existing "Days per week"/"Other
  training" step (step 6): which weekdays the athlete can train
  (`trainingWeekdays`, multi-select Mon–Sun), which weekdays are already
  lifting/sport days (`otherTrainingWeekdays`, multi-select — may overlap
  with training weekdays), and units (`unitSystem`, mi/km vs. km, a single
  toggle). `daysPerWeek` is kept and now derived as
  `trainingWeekdays.length` — the numeric stepper is replaced by the weekday
  picker, not kept alongside it (one source of truth, not two that can
  disagree).
- **On finish**: `handleFinish` builds the block and athlete as it does
  today, then calls `generatePlan(...)` and shows a new **preview step**
  (first 2 weeks of the generated plan — a flat list of date, discipline,
  type, and duration/distance, grouped by week) with **Confirm** and
  **Back** actions. Nothing is persisted until Confirm: `startNewBlock`,
  `saveAthlete`, and the bulk session insert all happen together on
  confirmation, in one transaction, so a user who backs out leaves no
  partial block behind.
- The old "no baseline → seed one `time_trial` session a week out" special
  case is subsumed by the generator itself (every discipline's own
  checkpoint-test type gets scheduled early in base phase when
  `baselineSource === 'unknown'`) — `handleFinish` no longer hand-creates it.

## Screens

### Home: "Build my plan"

`HomeScreen` currently assumes `sessions` means "a plan exists." Add a
check: if the active block has zero sessions where `source !== 'user'`
removed... concretely, if `sessions.length === 0`, render a "Build my plan"
card (replacing `TodayCard`/`WeekRow`'s empty states) that calls
`generatePlan` using the existing block + athlete and persists the result —
this is exactly what covers accounts (yours included) that onboarded before
this phase shipped.

### Plan screen (new): `src/features/plan/PlanScreen.tsx`

`App.tsx` adds a `{ name: 'plan' }` view (this app has no router — it's a
small hand-rolled state machine in `App.tsx`, and Plan follows that
convention rather than introducing React Router for one screen) reachable
from a new button on `HomeScreen`'s `GoalStrip`.

- Whole block, week by week, from the block's `createdAt` (or `today`,
  whichever is later) to `targetDate`. Each week: phase label (Base/Build/
  Specific/Taper, or "Build"/"Deload" for non-race blocks), weekly totals
  (duration, distance per discipline, hard-session count).
- Each session row: type, discipline badge (for Mix blocks), duration/
  distance in the athlete's units, targets, note, and a logged/missed/
  pending indicator reusing `WeekRow`'s existing state model
  (`src/lib/home.ts`'s `DayCompletionState`, generalized to not assume
  running).
- **Edit a session**: type, date, duration/distance, targets, notes — opens
  a form (new `SessionEditForm.tsx`) that writes through
  `updatePrescribedSession` and sets `edited: true`.
- **Move/swap days**: drag-free, explicit "Move to..." date picker per
  session (simpler and more accessible than drag-and-drop on a touch
  screen); "swap" is just moving two sessions to each other's dates in one
  transaction.
- **Delete**: `deletePrescribedSession`.
- **Add a session**: new session form with `source: 'user'`.
- **Skip a day**: distinct from delete — sets the existing session's `type`
  to `'rest'` (clearing targets/steps) rather than removing the row, so
  "Update plan" never resurrects something explicitly skipped, and the week
  view shows "skipped" rather than just blank. Marked `edited: true`.
- **Edit the block**: goal, target date, event, and training days, in a
  form reachable from the Plan screen header. Training days live on
  `Athlete` (global), not per-block — this app has exactly one active block
  at a time (`startNewBlock` archives the previous one), so there's no
  real-world case where "this block's training days" and "the athlete's
  training days" diverge; editing them here writes through
  `saveAthlete`/the new athlete-update path, same storage as onboarding.
  Flagging this explicitly in case you'd rather it were block-scoped — happy
  to change it if so, but it'd mean two sources of truth for the exact same
  question Phase 1 already asked once.
- **Update plan**: regenerates only sessions dated `>= today` where
  `source === 'generated' && edited !== true`. Before applying, shows a
  summary: counts added/removed per discipline, any phase-boundary shifts
  (e.g. "Taper now starts Mar 2, was Mar 9"), and an explicit list of
  user-edited/user-added future sessions that are kept untouched. One edge
  case worth stating plainly: if the new target date is *earlier* than some
  user-edited session's date, that session is deleted (it would be
  scheduled after the event) and called out by name in the summary, not
  silently dropped.

  Kept edited/user sessions are **fixed inputs to the regeneration**, not
  just rows the diff happens to leave alone: `schedule.ts` takes them as
  part of its input, counts their duration/distance toward that week's
  volume and their `intensity` toward that week's hard/moderate-session
  count (so a kept hard session really does occupy one of that week's 1–2
  hard-session slots), and never places a newly-generated session on a date
  one of them already occupies. This applies on every call to the
  generator, not only "Update plan" — a freshly-generated plan has no
  edited sessions yet, but the same function signature and the same rule
  apply uniformly rather than "Update plan" being special-cased.

## Matching logs to planned sessions

A log — manual or Strava — attaches to the planned session on the same date
with the same discipline, if one exists and isn't already logged. Same rule,
two implementations (client Dexie, server Postgres — different stacks,
can't share code, so the rule is kept deliberately simple to keep both
copies obviously correct and in sync):

- **Client** (`src/db/repository.ts`): `createSessionLog`, when called with
  `sessionId: null`, looks up `listSessionsForBlock(blockId)` for a session
  on `log.date` with `discipline === log.discipline` not already referenced
  by any `SessionLog.sessionId`, and attaches it (ties broken by whichever
  session has the lower `id` lexically — deterministic, not meaningful).
  Logging from `TodayCard`'s "Log it" (which already passes a specific
  `session`) is unaffected — this only changes the ad-hoc/no-session-
  preselected path, which is exactly where the gap is today.
- **Server** (`server/src/lib/strava.ts::upsertActivityLog`): same lookup
  against `prescribedSessions` for the active block, by `date` + the
  activity's mapped `discipline` (`mapActivityTypeToDiscipline`), restricted
  to sessions with no existing `sessionLogs.sessionId` reference.

**Missed sessions don't pile up**: this is a design invariant, not a
feature to build — the generator produces the whole plan up front from
`today` forward and never diffs against what happened on past dates to
reschedule them. A missed Tuesday stays missed; Wednesday's session is
whatever was already planned for Wednesday. The only things that change a
future session are explicit user edits and the two adaptation rules below.

## Adaptation

`src/lib/plan/adapt.ts`, called from `repository.ts` right after a log is
saved (same place `touchMeta`/the existing time-trial-to-effort logic
already runs) — no cron, no server job, since this is a serverless app with
nowhere to run one:

- **Fatigue/pain lightening**: after each `createSessionLog`, check the
  trailing 7 days of logs for the same block. If **2 or more** carry
  `cutShortReason` of `'fatigue'` or `'pain'`, lighten the *upcoming* week
  (next Monday–Sunday): drop one hard session to moderate (or moderate to
  easy if there's no hard one), and cut the week's longest session's target
  by ~20% — applied only to `source === 'generated' && edited !== true`
  sessions, each getting a note appended explaining why (e.g. "Lightened —
  two cut-short sessions for fatigue this week."). **Idempotency**: guarded
  by checking whether any session in the target week's note already
  contains the fixed marker `"(adjusted for fatigue)"`, so repeated logs in
  the same trailing window don't compound the reduction every time; no new
  schema field needed for this.
- **Checkpoint retarget**: when a log is saved against a checkpoint-test
  session type (`time_trial`/`bike_time_trial`/`swim_time_trial`/
  `row_time_trial`) with both distance and duration, it's recorded as a
  `TimedEffort` (as today, generalized off the `discipline`) and every
  future `source === 'generated' && edited !== true` session for that
  discipline in the block gets its pace/split target recomputed from the
  new baseline — day placement and session type are untouched, only the
  numbers, plus a note ("Updated from your [date] time trial.").

Every automatic change — fatigue lightening or retarget — writes a `note`
saying why, per the brief's requirement; neither ever touches a session
dated before today or a `SessionLog`.

## Units

`Athlete.unitSystem` (`'metric' | 'imperial'`) governs display and entry
only; every stored field stays meters (`targetDistanceMeters`, `TimedEffort.
distanceMeters`, `SessionLog.actualDistanceMeters`) exactly as today. New
`src/lib/units.ts`:

```ts
export function displayDistance(meters: number, discipline: Discipline, unitSystem: UnitSystem): string
export function parseDistanceInput(value: string, discipline: Discipline, unitSystem: UnitSystem): number | null // -> meters
```

Swimming always shows meters or yards (never mi/km, regardless of
`unitSystem` — a 1500m swim doesn't become a mile-ish number any swimmer
would use); rowing always shows meters (erg pieces are universally meters,
`unitSystem` doesn't apply); running/cycling/walking show mi or km per
`unitSystem`. This replaces the free-text "Meters — roughly 1,609 per
mile..." hint pattern in `disciplines.ts`'s `distanceHint` with real
conversion in the Plan screen, the session edit form, and
`SessionLogger`'s distance field (currently always-meters input — becomes
unit-aware, reusing `parseDistanceInput`/`displayDistance`).

## Rule sources (→ `docs/plan-evidence.md`)

Created in the generator commit, one row per rule, verbatim from this spec:

| Rule | Source |
|---|---|
| ~80% easy / ~20% moderate-hard weekly distribution | Research-informed: the polarized-training distribution observed in elite endurance athletes (Seiler, "Intervals, Thresholds, and Long Slow Distance", 2009-era polarized-training literature). Applied here as a target ratio for recreational athletes, which the literature itself doesn't claim to validate — convention-by-extension, not a direct finding. |
| Max 2 hard sessions/week (1 beginner) | Coaching convention — widely used in popular structured-running methodologies (e.g. Daniels, Pfitzinger-style plans); no single controlled study cited. |
| Never two hard/moderate days back-to-back | Coaching convention (hard/easy alternation) — general recovery-adaptation practice, not a specific citation. |
| No hard sessions on lift/sport days | Design choice — avoids compounding fatigue across modalities; not drawn from a study. |
| Deload every 3–4 weeks | Coaching convention — common 3:1/4:1 build:recovery week cycling used across structured-training methodologies. |
| Longest session ≤ 110%/week of recent peak | Conservative reading of the popular "10% rule." Explicitly labeled here as a popularized heuristic with weak controlled-research support, used as a ceiling, not a target. |
| Taper length scaled to event-time bucket | Coaching convention — commonly seen taper lengths (days for 5K-length efforts, 1–3 weeks for marathon-length), not a single source. |
| Base 40% / Build 35% / Specific 25% phase split | Coaching convention — a simplified classic base/build/peak periodization structure (e.g. the shape used in Friel's *Training Bible*-style plans), not a precise prescribed ratio from research. |
| Week-1 general-fitness ramp-in (~80%) | Design choice — avoids a hard opening week for beginners/no-baseline athletes. |
| Long session on latest available training weekday | Placeholder convention — this app doesn't collect per-day time availability. |

## Testing

- Every new `src/lib/plan/*.ts` module: TDD, tests written first, following
  the existing `paceMath.test.ts`/`feasibility.test.ts` convention.
- `generate.test.ts`: the four "done means" scenarios as integration tests,
  plus invariant checks (training-weekday-only placement, hard-session caps,
  adjacency rule, deload cadence) run against randomized/varied inputs, not
  just the four named cases.
- `adapt.test.ts`: fatigue-lightening idempotency (same trailing window
  doesn't double-adjust), checkpoint retarget (future-only, edited-session-
  safe), missed-session non-pileup.
- Repository tests (`fake-indexeddb`, existing convention): new
  `updatePrescribedSession`/`deletePrescribedSession`/`updateBlock` each
  call `touchMeta` inside their transaction (same assertion style as
  existing repository tests, if any exist — otherwise a new
  `repository.test.ts`).
- Component tests: `OnboardingWizard` preview step, `PlanScreen` edit/
  delete/add/skip/update-plan-with-diff, `HomeScreen`'s new "Build my plan"
  CTA, `SessionLogger`'s date picker and unit-aware distance field.
- `npm test`, `npm run typecheck`, `npm run typecheck:api` before every
  commit, per your standing convention — tests and docs (including
  `plan-evidence.md`) updated in the same commit as the code they describe.

## Rollout

- Feature branch `phase2-plan-generator` (already created), never `main`.
- Commits in phases, each with a short update to you: (1) data model +
  Dexie v4 + server schema + drizzle migration (generated, not run) + zod
  schemas; (2) generator (`src/lib/plan/`, fully TDD'd, no UI wiring yet);
  (3) onboarding (new questions, preview step, generate-on-finish); (4) plan
  view + editing + block editing/"Update plan"; (5) matching + adaptation
  (client + server); (6) units.
- `npm run db:generate` happens in commit 1; **`npm run db:migrate` only
  after you explicitly say go** — it's the real Neon database.
- PR opened at the end against `main`, so both you and Harrison get the
  Vercel preview, per your standing instruction (and the dual-remote push
  note — `origin` then `vercel`, both on `main` only after merge, not from
  this branch).

## Open items carried forward

- Per-day time budgets (not just which weekdays) would let the long-session
  placement rule be more than a placeholder — revisit if this phase's
  "latest available weekday" convention turns out to feel wrong in practice.
- Cycling has no baseline-test path at all (no power meter, no comparable
  time-trial-to-pace pipeline) — if a power meter or a cycling-specific
  field test gets added later, `targetZoneLabel`-only cycling targets should
  be revisited.
- The fatigue-lightening threshold (2+ cut-short-for-fatigue/pain logs in a
  trailing week) and the 20% volume cut are both first-pass numbers with no
  user data behind them yet — same spirit as Phase 1's feasibility-ceiling
  open item, revisit once real usage exists.
