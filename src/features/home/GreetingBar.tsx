import { timeAwareGreeting } from '../../lib/home';

// Date, settings, and the avatar now live in AppShell's header (see
// components/AppShell.tsx) -- this is just the personalized greeting line,
// in Manrope/sentence case. (Bebas Neue has no real lowercase forms; using
// it here rendered as all-caps regardless of the string's actual case.)
interface Props {
  now: Date;
}

export default function GreetingBar({ now }: Props) {
  return <h1 className="font-body text-heading-lg font-bold text-primary">{timeAwareGreeting(now)}</h1>;
}
