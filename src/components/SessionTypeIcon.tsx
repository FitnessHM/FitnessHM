import {
  Feather, Route, Gauge, Flame, Zap, Repeat, Shuffle, Mountain,
  ArrowUpRight, Timer, Dumbbell, Moon, type LucideIcon,
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
};

export function sessionTypeLabel(type: SessionType): string {
  return LABELS[type];
}
