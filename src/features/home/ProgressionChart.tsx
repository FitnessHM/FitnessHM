import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { TimedEffort } from '../../db/schema';

interface Props {
  efforts: TimedEffort[];
}

export default function ProgressionChart({ efforts }: Props) {
  const data = efforts.map((e) => ({ date: e.date, seconds: e.timeSeconds }));
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" stroke="var(--color-text-faint)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--color-text-faint)" fontSize={11} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 10,
              fontFamily: 'var(--font-body)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--color-text-secondary)' }}
            itemStyle={{ color: 'var(--color-text-primary)' }}
          />
          <Line type="monotone" dataKey="seconds" stroke="var(--color-accent)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-accent)' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
