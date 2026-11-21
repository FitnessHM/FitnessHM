import type { Discipline } from '../../disciplines';
import type { DisciplineProfile } from './types';
import { RUNNING_PROFILE } from './running';
import { CYCLING_PROFILE } from './cycling';
import { SWIMMING_PROFILE } from './swimming';
import { ROWING_PROFILE } from './rowing';
import { WALKING_PROFILE } from './walking';

export const DISCIPLINE_PROFILES: Record<Discipline, DisciplineProfile | null> = {
  running: RUNNING_PROFILE,
  cycling: CYCLING_PROFILE,
  swimming: SWIMMING_PROFILE,
  rowing: ROWING_PROFILE,
  walking: WALKING_PROFILE,
  lifting: null,
  sports: null,
};

export function disciplineProfile(discipline: Discipline): DisciplineProfile | null {
  return DISCIPLINE_PROFILES[discipline] ?? null;
}

export { buildSessionFromProfile } from './common';
export type { SlotKind, SessionContent, BuildSessionParams, DisciplineProfile } from './types';
