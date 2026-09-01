import { Lightbulb } from 'lucide-react';
import type { Insight } from '../../lib/home';

interface Props {
  insight: Insight | null;
}

// Hides itself entirely when there's nothing real to say -- never a
// fortune-cookie fallback.
export default function InsightCard({ insight }: Props) {
  if (!insight) return null;
  return (
    <div className="flex items-start gap-3 rounded-card border border-accent/25 bg-accent/5 p-4">
      <Lightbulb className="h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
      <p className="font-body text-body text-primary">{insight.text}</p>
    </div>
  );
}
