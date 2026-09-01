import type { PrescribedSession } from '../../db/schema';
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

export default function TodayCard({ session, isLogged, onLog }: Props) {
  const isRest = session === null || session.type === 'rest';

  return (
    <Card raised className="space-y-4">
      <div className="flex items-center gap-2">
        <Chip tone={isRest ? 'default' : 'accent'}>
          {session ? <SessionTypeIcon type={session.type} className="h-3 w-3" /> : null}
          {session ? sessionTypeLabel(session.type) : 'Rest day'}
        </Chip>
      </div>

      {isRest ? (
        <div className="space-y-2">
          <p className="font-display text-title text-primary">
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
          <div className="space-y-1">
            <p className="font-display text-title text-primary">{sessionTypeLabel(session.type)}</p>
            {session.note && <p className="font-body text-body text-secondary">{session.note}</p>}
          </div>

          <div className="flex flex-wrap gap-6">
            {session.reps != null && <StatBlock value={session.reps} label="Reps" />}
            {session.targetPaceSecondsPerKm != null && (
              <StatBlock value={session.targetPaceSecondsPerKm} label="Target pace" formatter={formatMmSs} suffix="/km" />
            )}
            {session.targetDurationSeconds != null && (
              <StatBlock value={session.targetDurationSeconds} label="Duration" formatter={(v) => Math.round(v / 60).toString()} suffix=" min" />
            )}
          </div>
        </>
      )}

      {isLogged ? (
        <p className="font-body text-caption font-semibold text-success">Logged for today.</p>
      ) : (
        <Button variant={isRest ? 'ghost' : 'primary'} onClick={onLog} className="w-full">
          {isRest ? 'Log something anyway' : 'Log it'}
        </Button>
      )}
    </Card>
  );
}
