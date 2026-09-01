interface Props {
  counts: Record<string, number>;
}

export default function ReasonCountTable({ counts }: Props) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return (
    <table className="w-full font-body text-caption">
      <thead>
        <tr className="text-left text-secondary">
          <th className="pb-2 pr-4 font-semibold uppercase tracking-wide">Reason</th>
          <th className="pb-2 font-semibold uppercase tracking-wide">Count</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([reason, count]) => (
          <tr key={reason} className="border-t border-border">
            <td className="py-2 pr-4 capitalize text-primary">{reason}</td>
            <td className="tabular-nums py-2 text-primary">{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
