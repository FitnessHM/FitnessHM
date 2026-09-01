import type { ReactNode } from 'react';

interface Props {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export default function ListRow({ leading, title, subtitle, trailing, onClick, active = false }: Props) {
  const classes = `flex w-full items-center gap-3 rounded-control border px-3 py-3 text-left transition-colors ${
    active ? 'border-accent/50 bg-surface-raised' : 'border-border bg-surface'
  }`;

  const content = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-body font-semibold text-primary">{title}</p>
        {subtitle && <p className="truncate font-body text-caption text-secondary">{subtitle}</p>}
      </div>
      {trailing}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`pressable ${classes}`}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
