import { ClerkProvider, SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import PrivacyPage from './PrivacyPage';
import SyncGate from './SyncGate';
import './index.css';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

// No router in this app — the one static route that must work signed-out
// (Strava's API review requires a reachable privacy policy) is handled here,
// before the Clerk gate, rather than pulling in a routing library for it.
const root = createRoot(document.getElementById('root')!);

if (window.location.pathname === '/privacy') {
  root.render(
    <StrictMode>
      <PrivacyPage />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        <SignedOut>
          <main className="min-h-screen bg-bg flex items-center justify-center p-4">
            <SignIn routing="hash" />
          </main>
        </SignedOut>
        <SignedIn>
          <SyncGate>
            <div className="fixed top-3 right-3 z-50">
              <UserButton afterSignOutUrl="/" />
            </div>
            <App />
          </SyncGate>
        </SignedIn>
      </ClerkProvider>
    </StrictMode>,
  );
}
