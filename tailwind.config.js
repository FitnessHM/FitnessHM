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
        display: ['3.5rem', { lineHeight: '1.0', letterSpacing: '0.01em' }],
        title: ['1.5rem', { lineHeight: '1.15', letterSpacing: '0.02em' }],
        body: ['1rem', { lineHeight: '1.5' }],
        label: ['0.8125rem', { lineHeight: '1.3', letterSpacing: '0.08em' }],
        caption: ['0.75rem', { lineHeight: '1.3' }],
      },
      borderRadius: {
        card: '14px',
        control: '10px',
      },
    },
  },
  plugins: [],
};
