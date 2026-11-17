import { useEffect, useMemo, useRef } from 'react';
import { solarisAudio, warmthLabel, warmthToHz } from '../audio/solarisAudio';

interface WarmthDialProps {
  value: number;
  onChange: (next: number) => void;
}

export function WarmthDial({ value, onChange }: WarmthDialProps) {
  const draggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const startYRef = useRef(0);
  const valueRef = useRef(value);
  const lastDetentRef = useRef(Math.round(value * 24));
  const knobRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const ticks = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => {
      const deg = -135 + (i / 24) * 270;
      const rad = ((deg - 90) * Math.PI) / 180;
      const r1 = i % 6 === 0 ? 41 : 43;
      const r2 = 48;
      return {
        i,
        x1: Math.cos(rad) * r1,
        y1: Math.sin(rad) * r1,
        x2: Math.cos(rad) * r2,
        y2: Math.sin(rad) * r2,
      };
    });
  }, []);

  const updateWithDetent = (raw: number) => {
    const clamped = Math.max(0, Math.min(1, raw));
    const step = Math.round(clamped * 24);
    if (step !== lastDetentRef.current) {
      solarisAudio.playMechClick(1450 + step * 24, 0.045);
      lastDetentRef.current = step;
    }
    onChange(clamped);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dy = startYRef.current - e.clientY;
      startYRef.current = e.clientY;
      if (dy !== 0) dragMovedRef.current = true;
      updateWithDetent(valueRef.current + dy * 0.01);
    };

    const onMouseUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  });

  useEffect(() => {
    const el = knobRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      updateWithDetent(valueRef.current - e.deltaY * 0.002);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const litCount = Math.round(value * 25);
  const deg = -135 + value * 270;
  const hz = warmthToHz(value);
  const label = warmthLabel(value);

  return (
    <div className="vernier-row">
      <div className="vwrap">
        <svg className="vticks" viewBox="-55 -55 110 110">
          {ticks.map((t) => (
            <line
              key={t.i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              className={t.i < litCount ? 'lit' : undefined}
            />
          ))}
        </svg>
        <div
          ref={knobRef}
          className="rotary-knob"
          role="slider"
          tabIndex={0}
          aria-label="Master warmth filter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          title="Drag up/down, two-finger scroll, or click"
          onMouseDown={(e) => {
            draggingRef.current = true;
            dragMovedRef.current = false;
            startYRef.current = e.clientY;
          }}
          onClick={() => {
            if (dragMovedRef.current) {
              dragMovedRef.current = false;
              return;
            }
            solarisAudio.playMechClick(820);
            updateWithDetent(value > 0.85 ? 0.15 : value + 0.25);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
              e.preventDefault();
              updateWithDetent(value + 0.05);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
              e.preventDefault();
              updateWithDetent(value - 0.05);
            }
          }}
        >
          <div
            className="knob-notch"
            style={{ transform: `translateX(-50%) rotate(${deg}deg)` }}
          />
        </div>
      </div>

      <div className="vinfo">
        <div className="t">Warmth</div>
        <div id="tone-readout">
          {hz} Hz • {label}
        </div>
        <span className="manual-badge">MANUAL FILTER</span>
      </div>
    </div>
  );
}
