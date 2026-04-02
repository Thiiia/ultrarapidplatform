'use client';

import { useEffect, useState } from 'react';
import UnityPlayer from './UnityPlayer';

type GameLauncherProps = {
  autoStart?: boolean;
};

export default function GameLauncher({
  autoStart = false,
}: GameLauncherProps) {
  const [launched, setLaunched] = useState(autoStart);

  useEffect(() => {
    if (autoStart) {
      setLaunched(true);
    }
  }, [autoStart]);

  const launchPayload = {
    userId: 'user_123',
    sessionToken: 'session_token_here',
    levelId: 'level-1',
  };

  if (!launched) {
    return (
      <div className="max-w-xl rounded-2xl border p-6">
        <h2 className="mb-2 text-xl font-semibold">Launch Game</h2>
        <p className="mb-4 text-sm text-gray-600">
          Click below to load the Unity WebGL client.
        </p>

        <button
          type="button"
          onClick={() => setLaunched(true)}
          className="rounded border px-4 py-2"
        >
          Launch
        </button>
      </div>
    );
  }

  return <UnityPlayer launchPayload={launchPayload} />;
}