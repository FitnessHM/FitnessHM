import { Check, X, Moon } from 'lucide-react';
import type { WeekDay } from '../../lib/home';
import SessionTypeIcon from '../../components/SessionTypeIcon';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Props {
  days: WeekDay[];
  onTapToday: () => void;
}

export default function WeekRow({ days, onTapToday }: Props) {
  return (
    <div className="flex justify-between gap-1.5">
      {days.map((day, i) => (
        <DayCell key={day.date} day={day} letter={DAY_LETTERS[i]} onClick={day.isToday ? onTapToday : undefined} />
      ))}
    </div>
  );
}

function DayCell({ day, letter, onClick }: { day: WeekDay; letter: string; onClick?: () => void }) {
  const classes = `flex flex-1 flex-col items-center gap-1.5 rounded-control border py-2.5 transition-colors ${
    day.isToday ? 'border-accent bg-accent/10' : 'border-border bg-surface'
  }`;
  const content = (
    <>
      <span className="font-body text-caption font-bold text-faint">{letter}</span>
      <CellIcon day={day} />
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`pressable ${classes}`}>
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
    return <SessionTypeIcon type={day.session.type} className={`h-4 w-4 ${day.isToday ? 'text-accent' : 'text-secondary'}`} />;
  }
  return <Moon className="h-4 w-4 text-faint" strokeWidth={2} />;
}
