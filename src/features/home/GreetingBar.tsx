import { Settings } from 'lucide-react';
import { timeAwareGreeting } from '../../lib/home';

function formatToday(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

interface Props {
  now: Date;
  onOpenSettings: () => void;
}

export default function GreetingBar({ now, onOpenSettings }: Props) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="font-display text-title text-primary">{timeAwareGreeting(now)}</h1>
      <div className="flex items-center gap-3">
        <p className="font-body text-caption text-secondary">{formatToday(now)}</p>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="settings"
          className="pressable rounded-control p-1.5 text-secondary hover:text-primary"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
