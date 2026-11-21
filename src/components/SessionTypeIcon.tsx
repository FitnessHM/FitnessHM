import {
  Feather, Route, Gauge, Flame, Zap, Repeat, Shuffle, Mountain,
  ArrowUpRight, Timer, Dumbbell, Moon, Bike, Waves, Droplets, Sailboat,
  PersonStanding, type LucideIcon,
} from 'lucide-react';
import type { SessionType } from '../db/schema';

const ICONS: Record<SessionType, LucideIcon> = {
  easy: Feather,
  long_run: Route,
  tempo: Gauge,
  threshold: Flame,
  vo2max: Zap,
  reps_short: Repeat,
  reps_800: Repeat,
  fartlek: Shuffle,
  hills: Mountain,
  strides: ArrowUpRight,
  time_trial: Timer,
  cross_training: Dumbbell,
  rest: Moon,
  bike_endurance: Bike,
  bike_sweet_spot_threshold: Gauge,
  bike_vo2_intervals: Zap,
  bike_long_ride: Route,
  bike_recovery_spin: Feather,
  bike_time_trial: Timer,
  swim_technique_drill: Droplets,
  swim_aerobic_sets: Waves,
  swim_threshold_css: Flame,
  swim_continuous: Route,
  swim_time_trial: Timer,
  row_steady_state: Sailboat,
  row_threshold_pieces: Flame,
  row_intervals: Zap,
  row_time_trial: Timer,
  walk_brisk: PersonStanding,
  walk_long: Route,
  walk_hills: Mountain,
};

interface Props {
  type: SessionType;
  className?: string;
}

export default function SessionTypeIcon({ type, className = 'h-4 w-4' }: Props) {
  const Icon = ICONS[type];
  return <Icon className={className} strokeWidth={2} />;
}

const LABELS: Record<SessionType, string> = {
  easy: 'Easy',
  long_run: 'Long run',
  tempo: 'Tempo',
  threshold: 'Threshold',
  vo2max: 'VO2 max',
  reps_short: 'Short reps',
  reps_800: '800m reps',
  fartlek: 'Fartlek',
  hills: 'Hill reps',
  strides: 'Strides',
  time_trial: 'Time trial',
  cross_training: 'Cross-training',
  rest: 'Rest',
  bike_endurance: 'Endurance ride',
  bike_sweet_spot_threshold: 'Sweet spot / threshold',
  bike_vo2_intervals: 'VO2 intervals',
  bike_long_ride: 'Long ride',
  bike_recovery_spin: 'Recovery spin',
  bike_time_trial: 'Time trial',
  swim_technique_drill: 'Technique / drills',
  swim_aerobic_sets: 'Aerobic sets',
  swim_threshold_css: 'Threshold (CSS)',
  swim_continuous: 'Continuous swim',
  swim_time_trial: 'Time trial',
  row_steady_state: 'Steady state',
  row_threshold_pieces: 'Threshold pieces',
  row_intervals: 'Intervals',
  row_time_trial: 'Time trial',
  walk_brisk: 'Brisk walk',
  walk_long: 'Long walk',
  walk_hills: 'Hill walk',
};

export function sessionTypeLabel(type: SessionType): string {
  return LABELS[type];
}
