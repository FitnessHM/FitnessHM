interface Props {
  counts: Record<string, number>;
}

export default function ReasonCountTable({ counts }: Props) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return (
    <table className="w-full text-sm mt-4">
      <thead>
        <tr className="text-left text-slate-400">
          <th className="pr-4">Reason</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([reason, count]) => (
          <tr key={reason}>
            <td className="pr-4">{reason}</td>
            <td>{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
