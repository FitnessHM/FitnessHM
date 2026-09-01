import { timeAwareGreeting } from '../../lib/home';

function formatToday(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

interface Props {
  now: Date;
}

export default function GreetingBar({ now }: Props) {
  return (
    <div className="flex items-baseline justify-between">
      <h1 className="font-display text-title text-primary">{timeAwareGreeting(now)}</h1>
      <p className="font-body text-caption text-secondary">{formatToday(now)}</p>
    </div>
  );
}
