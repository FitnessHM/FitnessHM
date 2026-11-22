import { Check, X, Moon } from 'lucide-react';
import type { WeekDay } from '../../lib/home';
import { sessionIntensity } from '../../lib/plan/intensity';
import SessionTypeIcon from '../../components/SessionTypeIcon';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const INTENSITY_DOT: Record<string, string> = {
  easy: 'bg-success',
  moderate: 'bg-caution',
  hard: 'bg-alert',
};

function formatWeeklyTotal(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours}h ${minutes}m`;
}

interface Props {
  days: WeekDay[];
  onTapToday: () => void;
}

export default function WeekRow({ days, onTapToday }: Props) {
  const totalSeconds = days.reduce((sum, d) => sum + (d.session?.targetDurationSeconds ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-1.5">
        {days.map((day, i) => (
          <DayCell key={day.date} day={day} letter={DAY_LETTERS[i]} onClick={day.isToday ? onTapToday : undefined} />
        ))}
      </div>
      {totalSeconds > 0 && (
        <p className="font-body text-caption text-secondary">
          <span className="font-display text-[1.125rem] leading-none text-primary">{formatWeeklyTotal(totalSeconds)}</span>
          {' planned this week'}
        </p>
      )}
    </div>
  );
}

function DayCell({ day, letter, onClick }: { day: WeekDay; letter: string; onClick?: () => void }) {
  const dateNum = new Date(day.date + 'T00:00:00').getDate();
  const classes = `flex flex-1 flex-col items-center gap-1 rounded-control border py-2.5 transition-colors ${
    day.isToday ? 'border-accent bg-accent/10' : 'border-border bg-surface'
  }`;
  const content = (
    <>
      <span className="font-body text-[0.6875rem] font-bold uppercase tracking-wide text-faint">{letter}</span>
      <span className={`tabular-nums font-body text-caption font-bold ${day.isToday ? 'text-primary' : 'text-secondary'}`}>
        {dateNum}
      </span>
      <CellIcon day={day} />
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={`${letter} ${dateNum}`} className={`pressable ${classes}`}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

function CellIcon({ day }: { day: WeekDay }) {
  if (day.state === 'completed') return <Check className="h-4 w-4 text-success" strokeWidth={3} />;
  if (day.state === 'missed') return <X className="h-4 w-4 text-faint" strokeWidth={2.5} />;
  if (day.session && day.state !== 'rest') {
    const intensity = sessionIntensity(day.session);
    return (
      <span className="flex flex-col items-center gap-0.5">
        <SessionTypeIcon type={day.session.type} className={`h-4 w-4 ${day.isToday ? 'text-accent' : 'text-secondary'}`} />
        <span className={`h-1 w-1 rounded-full ${INTENSITY_DOT[intensity]}`} aria-hidden="true" />
      </span>
    );
  }
  return <Moon className="h-4 w-4 text-faint" strokeWidth={2} />;
}
