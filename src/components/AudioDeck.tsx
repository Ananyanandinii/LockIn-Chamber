import { solarisAudio } from '../audio/solarisAudio';
import type { OrbControlState, RippleOptions } from '../types/solaris';
import { HarmonicOrb } from './HarmonicOrb';
import { WarmthDial } from './WarmthDial';

interface AudioDeckProps {
  brownOn: boolean;
  rainOn: boolean;
  brownVol: number;
  rainVol: number;
  warmth: number;
  micOn: boolean;
  onToggleBrown: () => void;
  onToggleRain: () => void;
  onBrownVolChange: (v: number) => void;
  onRainVolChange: (v: number) => void;
  onWarmthChange: (v: number) => void;
  onToggleMic: () => void;
  onSpawnRipple: (opts: RippleOptions) => void;
  onSetOrbState: (state: OrbControlState) => void;
  onRegisterOrbFrame: (cb: ((x: number, y: number, gathered: number) => void) | null) => void;
  onRegisterOrbRecalled: (cb: (() => void) | null) => void;
}

export function AudioDeck({
  brownOn,
  rainOn,
  brownVol,
  rainVol,
  warmth,
  micOn,
  onToggleBrown,
  onToggleRain,
  onBrownVolChange,
  onRainVolChange,
  onWarmthChange,
  onToggleMic,
  onSpawnRipple,
  onSetOrbState,
  onRegisterOrbFrame,
  onRegisterOrbRecalled,
}: AudioDeckProps) {
  const handleBowl = () => {
    solarisAudio.playSingingBowl();
    onSpawnRipple({
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5,
      r: 40,
      alpha: 0.9,
    });
    onSpawnRipple({
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5,
      r: 12,
      alpha: 0.6,
      sp: 3.2,
    });
  };

  return (
    <section className="capsule left" aria-label="Acoustic Sanctuary">
      <div className="rockers">
        <div className="channel-col">
          <button
            type="button"
            className={brownOn ? 'rocker on' : 'rocker'}
            onClick={onToggleBrown}
          >
            <div className="rk-track">
              <div className="rk-thumb" />
            </div>
            Brown
          </button>
          <input
            type="range"
            className="vol-fader"
            min={0}
            max={100}
            value={Math.round(brownVol * 100)}
            onChange={(e) => onBrownVolChange(Number(e.target.value) / 100)}
            title="Brown noise volume"
            aria-label="Brown noise volume"
          />
        </div>

        <div className="channel-col">
          <button
            type="button"
            className={rainOn ? 'rocker on' : 'rocker'}
            onClick={onToggleRain}
          >
            <div className="rk-track">
              <div className="rk-thumb" />
            </div>
            Rain
          </button>
          <input
            type="range"
            className="vol-fader"
            min={0}
            max={100}
            value={Math.round(rainVol * 100)}
            onChange={(e) => onRainVolChange(Number(e.target.value) / 100)}
            title="Rain volume"
            aria-label="Rain volume"
          />
        </div>
      </div>

      <hr className="hair" />

      <WarmthDial value={warmth} onChange={onWarmthChange} />

      <HarmonicOrb
        onSpawnRipple={onSpawnRipple}
        onSetOrbState={onSetOrbState}
        onRegisterFrameCallback={onRegisterOrbFrame}
        onRegisterRecalledCallback={onRegisterOrbRecalled}
      />

      <div className="duo">
        <button
          type="button"
          className={micOn ? 'tactile-key on' : 'tactile-key'}
          onClick={onToggleMic}
        >
          <span className="key-led" />
          Mic shield
        </button>
        <button type="button" className="tactile-key" onClick={handleBowl}>
          <span className="key-led" style={{ background: '#ffb703' }} />
          Bowl
        </button>
      </div>
    </section>
  );
}
