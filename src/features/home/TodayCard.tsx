import type { PrescribedSession } from '../../db/schema';
import { disciplineConfig } from '../../lib/disciplines';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import StatBlock from '../../components/StatBlock';
import SessionTypeIcon, { sessionTypeLabel } from '../../components/SessionTypeIcon';
import { formatMmSs } from '../../lib/format';

interface Props {
  session: PrescribedSession | null;
  isLogged: boolean;
  onLog: () => void;
}

interface KeyStat {
  value: number;
  label: string;
  formatter?: (n: number) => string;
  suffix?: string;
}

// Up to 3 "big number" targets, in each sport's own terms -- whichever of
// these a session actually has set. Capped at 3 so the hero never turns
// into a stat dump.
function keyStats(session: PrescribedSession): KeyStat[] {
  const stats: KeyStat[] = [];
  if (session.targetDurationSeconds != null) {
    stats.push({ value: session.targetDurationSeconds, label: 'Duration', formatter: (v) => Math.round(v / 60).toString(), suffix: ' min' });
  }
  if (session.targetDistanceMeters != null) {
    stats.push({ value: session.targetDistanceMeters / 1000, label: 'Distance', formatter: (v) => v.toFixed(1), suffix: ' km' });
  }
  if (session.targetPaceSecondsPerKm != null) {
    stats.push({ value: session.targetPaceSecondsPerKm, label: 'Pace', formatter: formatMmSs, suffix: '/km' });
  }
  if (session.targetPaceSecondsPer100m != null) {
    stats.push({ value: session.targetPaceSecondsPer100m, label: 'Pace', formatter: formatMmSs, suffix: '/100m' });
  }
  if (session.targetSplitSecondsPer500m != null) {
    stats.push({ value: session.targetSplitSecondsPer500m, label: 'Split', formatter: formatMmSs, suffix: '/500m' });
  }
  if (session.reps != null) {
    stats.push({ value: session.reps, label: 'Reps' });
  }
  return stats.slice(0, 3);
}

export default function TodayCard({ session, isLogged, onLog }: Props) {
  const isRest = session === null || session.type === 'rest';
  const Icon = session ? disciplineConfig(session.discipline).icon : null;
  const stats = session ? keyStats(session) : [];

  return (
    <Card raised className="space-y-5 p-6">
      <div className="flex items-center gap-2">
        <Chip tone={isRest ? 'default' : 'accent'}>
          {session ? <SessionTypeIcon type={session.type} className="h-3 w-3" /> : null}
          {session ? sessionTypeLabel(session.type) : 'Rest day'}
        </Chip>
      </div>

      {isRest ? (
        <div className="space-y-2">
          <p className="font-body text-heading font-bold text-primary">
            {session === null ? 'Nothing scheduled today' : 'Rest day'}
          </p>
          <p className="font-body text-body text-secondary">
            {session === null
              ? 'No session prescribed for today. Rest, or an easy effort if you feel like it -- your call.'
              : 'Recovery is when the fitness actually happens. Come back tomorrow ready to work.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-accent/10">
                <Icon className="h-5 w-5 text-accent" strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0 space-y-1">
              <p className="font-body text-heading font-bold text-primary">{sessionTypeLabel(session.type)}</p>
              {session.note && <p className="font-body text-body text-secondary">{session.note}</p>}
            </div>
          </div>

          {stats.length > 0 ? (
            <div className="flex flex-wrap gap-6">
              {stats.map((s, i) => (
                <StatBlock key={i} value={s.value} label={s.label} formatter={s.formatter} suffix={s.suffix} />
              ))}
            </div>
          ) : (
            session.targetRpeMin != null && (
              <p className="font-body text-caption text-secondary">
                By feel -- RPE {session.targetRpeMin}
                {session.targetRpeMax != null && session.targetRpeMax !== session.targetRpeMin ? `-${session.targetRpeMax}` : ''}
                {session.targetZoneLabel ? ` -- ${session.targetZoneLabel}` : ''}
              </p>
            )
          )}
        </>
      )}

      {isLogged ? (
        <p className="font-body text-caption font-semibold text-success">Logged for today.</p>
      ) : (
        <Button variant={isRest ? 'ghost' : 'primary'} onClick={onLog} className="w-full text-[1.0625rem]">
          {isRest ? 'Log something anyway' : 'Log it'}
        </Button>
      )}
    </Card>
  );
}
