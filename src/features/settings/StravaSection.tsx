import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import Button from '../../components/Button';
import Card from '../../components/Card';

type Status = 'loading' | 'connected' | 'disconnected';

interface Props {
  notice: 'connected' | 'denied' | 'error' | null;
}

export default function StravaSection({ notice }: Props) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const refreshStatus = async () => {
    const token = await getToken();
    const res = await fetch('/api/strava/status', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setStatus('disconnected');
      return;
    }
    const data = (await res.json()) as { connected: boolean };
    setStatus(data.connected ? 'connected' : 'disconnected');
  };

  useEffect(() => {
    refreshStatus().catch(() => setStatus('disconnected'));
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

  return (
    <Card className="space-y-3">
      <h2 className="font-body text-body font-bold text-primary">Strava</h2>

      {notice === 'connected' && (
        <p className="font-body text-caption text-success">Connected — recent activities are importing now.</p>
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

      {status === 'loading' && <p className="font-body text-caption text-secondary">Checking…</p>}

      {status === 'disconnected' && (
        <a
          href="/api/strava/connect"
          className="pressable inline-flex items-center justify-center rounded-control px-5 py-3 font-body text-body font-bold text-white transition-colors hover:brightness-110"
          style={{ backgroundColor: '#FC4C02' }}
        >
          Connect with Strava
        </a>
      )}

      {status === 'connected' && (
        <div className="space-y-2">
          <p className="font-body text-caption text-success">Connected</p>
          <Button variant="secondary" onClick={handleDisconnect} disabled={isDisconnecting}>
            {isDisconnecting ? 'Disconnecting…' : 'Disconnect Strava'}
          </Button>
        </div>
      )}

      <p className="font-body text-caption text-faint">Powered by Strava</p>
    </Card>
  );
}
