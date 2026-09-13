import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import Button from '../../components/Button';
import Card from '../../components/Card';

interface StravaStatus {
  connected: boolean;
  athleteFirstName: string | null;
  athleteAvatarUrl: string | null;
  lastSyncedAt: string | null;
  activityCount: number;
}

const IDLE_STATUS: StravaStatus = {
  connected: false, athleteFirstName: null, athleteAvatarUrl: null, lastSyncedAt: null, activityCount: 0,
};

interface Props {
  notice: 'connected' | 'denied' | 'error' | null;
}

function formatLastSynced(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function StravaSection({ notice }: Props) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshStatus = async () => {
    const token = await getToken();
    const res = await fetch('/api/strava/status', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setStatus(IDLE_STATUS);
      return;
    }
    setStatus((await res.json()) as StravaStatus);
  };

  useEffect(() => {
    refreshStatus().catch(() => setStatus(IDLE_STATUS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const token = await getToken();
      await fetch('/api/strava/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      await refreshStatus();
    } catch (err) {
      console.error('Strava disconnect failed', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/strava/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setStatus((await res.json()) as StravaStatus);
    } catch (err) {
      console.error('Strava sync failed', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="font-body text-body font-bold text-primary">Strava</h2>

      {notice === 'connected' && (
        <p className="font-body text-caption text-success">Strava connected — syncing your last 30 days.</p>
      )}
      {notice === 'denied' && (
        <p className="font-body text-caption text-secondary">Strava connection cancelled.</p>
      )}
      {notice === 'error' && (
        <p className="font-body text-caption text-alert">Something went wrong connecting to Strava. Try again.</p>
      )}

      <p className="font-body text-caption text-secondary">
        Connect your Strava account to automatically pull in cardio activities as completed sessions.
      </p>

      {status === null && <p className="font-body text-caption text-secondary">Checking…</p>}

      {status && !status.connected && (
        <a
          href="/api/strava/connect"
          className="pressable inline-flex items-center justify-center rounded-control px-5 py-3 font-body text-body font-bold text-white transition-colors hover:brightness-110"
          style={{ backgroundColor: '#FC4C02' }}
        >
          Connect with Strava
        </a>
      )}

      {status?.connected && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {status.athleteAvatarUrl ? (
              <img
                src={status.athleteAvatarUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-surface-raised" />
            )}
            <div>
              <p className="font-body text-body font-semibold text-primary">
                Connected{status.athleteFirstName ? ` as ${status.athleteFirstName}` : ''}
              </p>
              <p className="font-body text-caption text-secondary">
                {status.activityCount} {status.activityCount === 1 ? 'activity' : 'activities'} synced · last synced{' '}
                {formatLastSynced(status.lastSyncedAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleSyncNow} disabled={isSyncing}>
              {isSyncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button variant="ghost" onClick={handleDisconnect} disabled={isDisconnecting}>
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        </div>
      )}

      <p className="font-body text-caption text-faint">Powered by Strava</p>
    </Card>
  );
}
