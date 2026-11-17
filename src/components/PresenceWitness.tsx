import { useRef } from 'react';
import { solarisAudio } from '../audio/solarisAudio';
import { usePresenceWitness } from '../hooks/usePresenceWitness';
import type { CamMode } from '../types/solaris';

interface PresenceWitnessProps {
  mode: CamMode;
  onModeChange: (mode: CamMode) => void;
  onAway: () => void;
  onReturn: () => void;
}

const MODES: Array<{ id: CamMode; label: string }> = [
  { id: 'off', label: 'OFF' },
  { id: 'stealth', label: 'STEALTH' },
  { id: 'mirror', label: 'MIRROR' },
];

export function PresenceWitness({
  mode,
  onModeChange,
  onAway,
  onReturn,
}: PresenceWitnessProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const presence = usePresenceWitness(mode, videoRef, onAway, onReturn);

  const dotClass =
    presence.status === 'present'
      ? 'p-dot present'
      : presence.status === 'away'
        ? 'p-dot away'
        : 'p-dot';

  return (
    <>
      <div className="cap-label">Witness</div>
      <div className="cam-modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={mode === m.id ? 'cam-mode-btn active' : 'cam-mode-btn'}
            onClick={() => {
              solarisAudio.playMechClick(600);
              onModeChange(m.id);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        className={mode === 'mirror' ? 'mirror-viewport visible' : 'mirror-viewport'}
      >
        <video ref={videoRef} id="mirror-video" autoPlay playsInline muted />
      </div>

      <div className="presence-readout">
        <div>
          <span className={dotClass} />
          <span>{presence.text}</span>
        </div>
        <span style={{ color: 'var(--amber)' }}>{presence.timerText}</span>
      </div>
    </>
  );
}
