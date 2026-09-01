import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <p className="font-display text-title text-primary">{title}</p>
      {description && <p className="max-w-xs font-body text-body text-secondary">{description}</p>}
      {action}
    </div>
  );
}
