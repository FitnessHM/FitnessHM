import type { ElementType, HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  raised?: boolean;
  as?: ElementType;
}

export default function Card({ children, raised = false, as: Element = 'div', className = '', ...rest }: Props) {
  return (
    <Element
      className={`rounded-card border border-border ${raised ? 'bg-surface-raised' : 'bg-surface'} p-5 ${className}`}
      {...rest}
    >
      {children}
    </Element>
  );
}
