import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver, which Recharts' ResponsiveContainer
// requires to measure its container on mount. Polyfill with a no-op so charts
// can render in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
