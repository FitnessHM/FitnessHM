import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-accent-foreground hover:brightness-110',
  secondary: 'bg-surface-raised text-primary border border-border-strong hover:border-accent/40',
  ghost: 'bg-transparent text-secondary hover:text-primary',
  destructive: 'bg-transparent text-alert border border-alert/40 hover:bg-alert/10',
};

export default function Button({ variant = 'primary', className = '', disabled, children, ...rest }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`pressable rounded-control px-5 py-3 font-body text-body font-bold transition-colors disabled:pointer-events-none disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
