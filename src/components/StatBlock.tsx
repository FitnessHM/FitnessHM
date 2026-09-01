import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion';

type Tone = 'success' | 'caution' | 'alert';

interface Props {
  value: number;
  label: string;
  suffix?: string;
  formatter?: (n: number) => string;
  delta?: { text: string; tone: Tone };
}

const TONE_CLASSES: Record<Tone, string> = {
  success: 'text-success',
  caution: 'text-caution',
  alert: 'text-alert',
};

// Numbers count up from their previous value whenever `value` changes --
// including the very first render, since prevValue starts at 0. This is the
// one place in the app a raw number is allowed to feel alive.
export default function StatBlock({ value, label, suffix = '', formatter, delta }: Props) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const controls = animate(prevValue.current, value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value]);

  const shown = formatter ? formatter(display) : Math.round(display).toLocaleString();

  return (
    <div className="flex flex-col gap-1">
      <span className="tabular-nums font-display text-display leading-none text-primary">
        {shown}
        {suffix}
      </span>
      <span className="font-body text-label font-semibold uppercase tracking-wide text-secondary">{label}</span>
      {delta && <span className={`font-body text-caption font-semibold ${TONE_CLASSES[delta.tone]}`}>{delta.text}</span>}
    </div>
  );
}
