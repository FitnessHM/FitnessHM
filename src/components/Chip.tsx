import type { ReactNode } from 'react';

type Tone = 'default' | 'accent' | 'success' | 'caution' | 'alert';

interface Props {
  children: ReactNode;
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  default: 'bg-surface-raised text-secondary border-border-strong',
  accent: 'bg-accent text-accent-foreground border-transparent',
  success: 'bg-success/15 text-success border-success/30',
  caution: 'bg-caution/15 text-caution border-caution/30',
  alert: 'bg-alert/15 text-alert border-alert/30',
};

export default function Chip({ children, tone = 'default' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-body text-caption font-bold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
