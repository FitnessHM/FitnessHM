export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 bg-bg p-6 text-primary">
      <h1 className="font-display text-title">Privacy Policy</h1>
      <p className="font-body text-caption text-secondary">Last updated September 2026.</p>

      <section className="space-y-2">
        <h2 className="font-body text-body font-bold">What FitnessHM is</h2>
        <p className="font-body text-body text-secondary">
          FitnessHM is a personal training-planner app. This policy covers the account data it
          stores when you sign in and, optionally, connect Strava.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-body text-body font-bold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5 font-body text-body text-secondary">
          <li>Your email address, from Clerk, the authentication provider we use to sign you in.</li>
          <li>
            Training data you enter yourself: training blocks, goals, prescribed sessions, and the
            sessions you log (duration, distance, effort, notes).
          </li>
          <li>
            If you connect Strava: your Strava athlete id, an access/refresh token (encrypted at
            rest, never stored or shown in plain text), and activity data for cardio activities
            (type, date, duration, distance) — used to fill in completed sessions automatically.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-body text-body font-bold">How we use it</h2>
        <p className="font-body text-body text-secondary">
          Solely to run the app for you: showing your training plan, tracking your progress, and,
          if connected, pulling in your Strava activities as completed sessions. We don't sell
          data, share it with third parties for advertising, or use it for anything beyond making
          the app work for your account.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-body text-body font-bold">Where it's stored</h2>
        <p className="font-body text-body text-secondary">
          In a Postgres database (hosted by Neon) and on your own device (for offline use). Strava
          tokens are encrypted before storage.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-body text-body font-bold">Disconnecting Strava or deleting your data</h2>
        <p className="font-body text-body text-secondary">
          You can disconnect Strava at any time from Settings, which revokes FitnessHM's access on
          Strava's side and deletes the stored tokens. "Start over" in Settings permanently deletes
          all of your training data, on your device and on the server.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-body text-body font-bold">Contact</h2>
        <p className="font-body text-body text-secondary">
          Questions about this policy or your data: reach out to the person who gave you access to
          this app.
        </p>
      </section>
    </main>
  );
}
