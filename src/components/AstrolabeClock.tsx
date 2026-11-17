import { useMemo } from 'react';
import type { ClockStatus } from '../types/solaris';

interface AstrolabeClockProps {
  durationMins: number;
  remSec: number;
  overSec: number;
  isOvertime: boolean;
  running: boolean;
  status: ClockStatus;
  quote: string;
  onSelectDuration: (mins: number) => void;
  onToggleRun: () => void;
  onReset: () => void;
}

const PRESETS = [25, 45, 60, 90] as const;
const CIRC = 2 * Math.PI * 116;

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function AstrolabeClock({
  durationMins,
  remSec,
  overSec,
  isOvertime,
  running,
  status,
  quote,
  onSelectDuration,
  onToggleRun,
  onReset,
}: AstrolabeClockProps) {
  const ringTicks = useMemo(() => {
    return Array.from({ length: 36 }, (_, i) => {
      const rad = (i * 10 * Math.PI) / 180;
      const isMajor = i % 3 === 0;
      const r1 = isMajor ? 124 : 128;
      const r2 = isMajor ? 136 : 132;
      return {
        i,
        isMajor,
        x1: 160 + Math.cos(rad) * r1,
        y1: 160 + Math.sin(rad) * r1,
        x2: 160 + Math.cos(rad) * r2,
        y2: 160 + Math.sin(rad) * r2,
      };
    });
  }, []);

  const totalSec = durationMins * 60;
  const ratio = isOvertime ? 1 : Math.max(0, Math.min(1, remSec / totalSec));
  const dashOffset = isOvertime ? 0 : CIRC * (1 - ratio);
  const angle = ratio * Math.PI * 2;
  const headX = isOvertime ? 246 : 130 + Math.cos(angle) * 116;
  const headY = isOvertime ? 130 : 130 + Math.sin(angle) * 116;

  const primaryLabel = running
    ? 'PAUSE'
    : status === 'PAUSED' || status === 'PAUSED — AWAY'
      ? 'RESUME'
      : 'IGNITE FOCUS';

  return (
    <section className="center" aria-label="Solar Eclipse Chronometer">
      <div className="duration-bar">
        {PRESETS.map((mins) => (
          <button
            key={mins}
            type="button"
            className={durationMins === mins ? 'dur-btn active' : 'dur-btn'}
            onClick={() => onSelectDuration(mins)}
          >
            {mins}
          </button>
        ))}
      </div>

      <div className="astrolabe">
        <div className="solar-corona" />
        <svg className="rings" viewBox="0 0 320 320" aria-hidden="true">
          <g className="spin-a">
            <circle cx="160" cy="160" r="156" strokeDasharray="2 6" />
            <ellipse cx="160" cy="160" rx="156" ry="62" />
            <ellipse cx="160" cy="160" rx="62" ry="156" />
          </g>
          <g className="spin-b">
            <ellipse
              cx="160"
              cy="160"
              rx="148"
              ry="100"
              transform="rotate(32 160 160)"
            />
            <ellipse
              cx="160"
              cy="160"
              rx="148"
              ry="100"
              transform="rotate(-32 160 160)"
            />
          </g>
          <g className="spin-c">
            <circle cx="160" cy="160" r="140" strokeDasharray="40 8 4 8" />
          </g>
          <g>
            {ringTicks.map((t) => (
              <line
                key={t.i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                className={t.isMajor ? 'sun-ray' : undefined}
              />
            ))}
          </g>
        </svg>

        <svg className="dial-svg" viewBox="0 0 260 260" aria-hidden="true">
          <defs>
            <linearGradient id="cinemaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffb703" />
              <stop offset="50%" stopColor="#ff758f" />
              <stop offset="100%" stopColor="#e63956" />
            </linearGradient>
          </defs>
          <circle className="dial-track" cx="130" cy="130" r="116" />
          <circle
            className="dial-arc"
            cx="130"
            cy="130"
            r="116"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
          />
          <circle className="dial-head" cx={headX} cy={headY} r="4.5" />
        </svg>

        <div className="eclipse">
          <div
            className={
              status === 'PAUSED — AWAY' ? 'dial-status away' : 'dial-status'
            }
          >
            {status}
          </div>
          <div className={isOvertime ? 'dial-digits overtime' : 'dial-digits'}>
            {isOvertime ? `+${formatClock(overSec)}` : formatClock(remSec)}
          </div>
        </div>
      </div>

      <p className="center-quote">{quote}</p>

      <div className="transport">
        <button type="button" className="mech-btn" onClick={onToggleRun}>
          {primaryLabel}
        </button>
        <button type="button" className="btn-reset" onClick={onReset}>
          RESET
        </button>
      </div>
    </section>
  );
}
