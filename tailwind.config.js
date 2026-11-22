/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        faint: 'var(--color-text-faint)',
        accent: 'var(--color-accent)',
        'accent-foreground': 'var(--color-accent-foreground)',
        success: 'var(--color-success)',
        caution: 'var(--color-caution)',
        alert: 'var(--color-alert)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
      },
      fontSize: {
        // Unchanged (used across every screen, not just the ones in this
        // design pass -- redefining these would shift unreviewed screens
        // before their own pass). display/title stay font-display-paired
        // where that was already correct (the wordmark; "number-ish" short
        // labels on untouched screens); the redesign below mostly moves
        // *away* from font-display+title for sentence headings, toward
        // the new heading-lg/heading/heading-sm instead.
        display: ['3.5rem', { lineHeight: '1.0', letterSpacing: '0.01em' }],
        title: ['1.5rem', { lineHeight: '1.15', letterSpacing: '0.02em' }],
        body: ['1rem', { lineHeight: '1.5' }],
        label: ['0.8125rem', { lineHeight: '1.3', letterSpacing: '0.08em' }],
        caption: ['0.75rem', { lineHeight: '1.3' }],
        // New, additive. Bebas Neue only -- the wordmark and big numbers
        // (pace, time, distance, countdowns). Bebas has no real lowercase
        // forms, so using it for a sentence silently renders as all-caps
        // regardless of the text's actual case -- never pair this with
        // font-body text, only font-display numerals.
        stat: ['2.25rem', { lineHeight: '1.05', letterSpacing: '0.01em' }],
        // New, additive. Manrope, sentence case -- the real heading scale
        // for screen titles and card/session-name headings, replacing
        // font-display+text-title for anything that isn't a number.
        'heading-lg': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        heading: ['1.25rem', { lineHeight: '1.25', letterSpacing: '-0.005em' }],
        'heading-sm': ['1.0625rem', { lineHeight: '1.3' }],
      },
      spacing: {
        '3xs': 'var(--space-3xs)',
        '2xs': 'var(--space-2xs)',
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
      },
      borderRadius: {
        card: '14px',
        control: '10px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
