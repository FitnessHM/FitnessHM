import { ClerkProvider, SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      <SignedOut>
        <main className="min-h-screen bg-bg flex items-center justify-center p-4">
          <SignIn routing="hash" />
        </main>
      </SignedOut>
      <SignedIn>
        <div className="fixed top-3 right-3 z-50">
          <UserButton afterSignOutUrl="/" />
        </div>
        <App />
      </SignedIn>
    </ClerkProvider>
  </StrictMode>,
);
