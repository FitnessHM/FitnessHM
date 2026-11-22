import type { ReactNode } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { Home, Calendar, PlusCircle, Settings as SettingsIcon } from 'lucide-react';

export type Tab = 'today' | 'plan' | 'log' | 'settings';

const NAV_ITEMS: { tab: Tab; label: string; icon: typeof Home }[] = [
  { tab: 'today', label: 'Today', icon: Home },
  { tab: 'plan', label: 'Plan', icon: Calendar },
  { tab: 'log', label: 'Log', icon: PlusCircle },
  { tab: 'settings', label: 'Settings', icon: SettingsIcon },
];

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

interface Props {
  children: ReactNode;
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  now?: Date;
}

/**
 * Global chrome: wordmark + date + the Clerk avatar in one real header (not
 * a floating UserButton pinned to a corner), a bottom tab bar on mobile, a
 * left sidebar nav on desktop. Wraps every screen -- navigation chrome is
 * cross-cutting infrastructure, not a per-screen design choice, so it
 * rolls out immediately rather than waiting behind the per-screen review
 * gate the way each screen's own inner content does.
 */
export default function AppShell({ children, activeTab, onNavigate, now = new Date() }: Props) {
  return (
    <div className="min-h-screen bg-bg text-primary md:flex">
      {/* Desktop: left sidebar nav, wordmark + date/avatar included. */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <p className="px-2 font-display text-[1.75rem] leading-none text-primary">FitnessHM</p>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(tab)}
                aria-current={active ? 'page' : undefined}
                className={`pressable flex items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${
                  active ? 'bg-accent/10 text-primary' : 'text-secondary hover:bg-surface-raised hover:text-primary'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-accent' : ''}`} strokeWidth={2} />
                <span className="font-body text-body font-semibold">{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-3 px-2 pt-6">
          <UserButton afterSignOutUrl="/" />
          <span className="font-body text-caption text-secondary">{formatHeaderDate(now)}</span>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Header: every screen, mobile and desktop alike -- wordmark only
            shown here on mobile (desktop already has it in the sidebar). */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:justify-end md:border-none md:bg-transparent md:px-6 md:py-4">
          <p className="font-display text-[1.5rem] leading-none text-primary md:hidden">FitnessHM</p>
          <div className="flex items-center gap-3">
            <span className="font-body text-caption text-secondary">{formatHeaderDate(now)}</span>
            <span className="md:hidden">
              <UserButton afterSignOutUrl="/" />
            </span>
          </div>
        </header>

        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile: bottom tab bar. Hidden on desktop (sidebar nav covers it). */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
          aria-label="primary"
        >
          {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(tab)}
                aria-current={active ? 'page' : undefined}
                className="pressable flex flex-1 flex-col items-center gap-1 px-2 py-2.5"
              >
                <Icon className={`h-6 w-6 ${active ? 'text-accent' : 'text-secondary'}`} strokeWidth={2} />
                <span className={`font-body text-[0.6875rem] font-semibold ${active ? 'text-primary' : 'text-secondary'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
