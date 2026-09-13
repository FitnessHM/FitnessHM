import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { startOver } from '../../db/sync';
import Button from '../../components/Button';
import Card from '../../components/Card';

interface Props {
  onBack: () => void;
  onStartedOver: () => void;
}

export default function SettingsScreen({ onBack, onStartedOver }: Props) {
  const { getToken } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleConfirm = () => {
    setIsClearing(true);
    startOver(getToken)
      .catch((err) => console.error('start over failed', err))
      .finally(() => onStartedOver());
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-10">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="back"
          className="pressable -ml-2 rounded-control p-2 text-secondary hover:text-primary"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-display text-title text-primary">Settings</h1>
      </div>

      <Card className="space-y-3">
        <h2 className="font-body text-body font-bold text-primary">Start over</h2>
        <p className="font-body text-caption text-secondary">
          Deletes every block, effort, session, and log — on this device and on the server — then
          takes you back through onboarding. This can&apos;t be undone.
        </p>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Start over
        </Button>
      </Card>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card raised className="w-full max-w-sm space-y-4">
            <h2 className="font-body text-body font-bold text-primary">Delete everything?</h2>
            <p className="font-body text-caption text-secondary">
              This permanently deletes all your training data on this device and on the server.
              This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={isClearing}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={isClearing}>
                {isClearing ? 'Deleting…' : 'Delete everything'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
