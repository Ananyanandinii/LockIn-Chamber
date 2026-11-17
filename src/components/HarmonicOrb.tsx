import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { solarisAudio } from '../audio/solarisAudio';
import type { OrbControlState, OrbMode, RippleOptions } from '../types/solaris';

interface HarmonicOrbProps {
  onSpawnRipple: (opts: RippleOptions) => void;
  onSetOrbState: (state: OrbControlState) => void;
  onRegisterFrameCallback: (cb: ((x: number, y: number, gathered: number) => void) | null) => void;
  onRegisterRecalledCallback: (cb: (() => void) | null) => void;
}

export function HarmonicOrb({
  onSpawnRipple,
  onSetOrbState,
  onRegisterFrameCallback,
  onRegisterRecalledCallback,
}: HarmonicOrbProps) {
  const [orbMode, setOrbMode] = useState<OrbMode>('docked');

  const orbRef = useRef<HTMLDivElement | null>(null);
  const dockedDotRef = useRef<HTMLDivElement | null>(null);
  const escapedDotRef = useRef<HTMLDivElement | null>(null);

  const draggingRef = useRef(false);
  const lastNoteRef = useRef(-1);
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ vx: 0, vy: 0, lastX: 0, lastY: 0, lastT: 0 });
  const snapBackPosRef = useRef<{ leftPct: number; topPct: number } | null>(null);

  const applyEscapedTransform = useCallback((x: number, y: number, gathered = 0) => {
    posRef.current = { x, y };
    const dot = escapedDotRef.current;
    if (!dot) return;
    const scale = 1 + Math.min(0.45, gathered * 0.04);
    dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
  }, []);

  useEffect(() => {
    onRegisterFrameCallback((x, y, gathered) => {
      applyEscapedTransform(x, y, gathered);
    });
    return () => onRegisterFrameCallback(null);
  }, [onRegisterFrameCallback, applyEscapedTransform]);

  useEffect(() => {
    onRegisterRecalledCallback(() => {
      snapBackPosRef.current = null;
      setOrbMode('docked');
    });
    return () => onRegisterRecalledCallback(null);
  }, [onRegisterRecalledCallback]);

  // Position escaped portal dot synchronously on mount before paint
  useLayoutEffect(() => {
    if (orbMode === 'docked') return;
    applyEscapedTransform(posRef.current.x, posRef.current.y);
  }, [orbMode, applyEscapedTransform]);

  // Smooth spring snap-back from drop coordinate when returning to docked cradle
  useEffect(() => {
    if (orbMode !== 'docked' || !snapBackPosRef.current || !dockedDotRef.current) return;
    const { leftPct, topPct } = snapBackPosRef.current;
    snapBackPosRef.current = null;
    const dot = dockedDotRef.current;
    dot.style.transition = 'none';
    dot.style.left = `${leftPct}%`;
    dot.style.top = `${topPct}%`;
    void dot.offsetWidth;
    dot.style.transition = '';
    dot.style.left = '50%';
    dot.style.top = '44%';
  }, [orbMode]);

  const handleDragMove = (clientX: number, clientY: number, strike: boolean) => {
    const now = performance.now();
    const dt = Math.max(8, now - velRef.current.lastT);
    if (velRef.current.lastT > 0) {
      const instVx = ((clientX - velRef.current.lastX) / dt) * 16;
      const instVy = ((clientY - velRef.current.lastY) / dt) * 16;
      velRef.current.vx = velRef.current.vx * 0.55 + instVx * 0.45;
      velRef.current.vy = velRef.current.vy * 0.55 + instVy * 0.45;
    }
    velRef.current.lastX = clientX;
    velRef.current.lastY = clientY;
    velRef.current.lastT = now;

    applyEscapedTransform(clientX, clientY);
    onSetOrbState({
      mode: 'dragging',
      x: clientX,
      y: clientY,
      vx: velRef.current.vx,
      vy: velRef.current.vy,
    });

    const el = orbRef.current;
    const rect = el?.getBoundingClientRect();
    const inCradle =
      rect !== undefined &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;

    const nx = inCradle && rect
      ? (clientX - rect.left) / rect.width
      : Math.max(0, Math.min(1, clientX / window.innerWidth));
    const ny = inCradle && rect
      ? (clientY - rect.top) / rect.height
      : Math.max(0, Math.min(1, clientY / window.innerHeight));

    const noteIdx = Math.min(7, Math.max(0, Math.floor(nx * 8)));
    if (strike || noteIdx !== lastNoteRef.current) {
      lastNoteRef.current = solarisAudio.pluckHarmonic(nx, ny);
      onSpawnRipple({
        x: clientX,
        y: clientY,
        r: strike ? 18 : 10,
        alpha: strike ? 0.72 : 0.42,
        sp: strike ? 6.0 : 4.2,
      });
    }
  };

  const finishDrag = (clientX: number, clientY: number) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    lastNoteRef.current = -1;

    const el = orbRef.current;
    const rect = el?.getBoundingClientRect();
    const pad = 10;
    const droppedInside =
      rect !== undefined &&
      clientX >= rect.left - pad &&
      clientX <= rect.right + pad &&
      clientY >= rect.top - pad &&
      clientY <= rect.bottom + pad;

    if (droppedInside && rect) {
      const leftPct = Math.max(6, Math.min(94, ((clientX - rect.left) / rect.width) * 100));
      const topPct = Math.max(10, Math.min(90, ((clientY - rect.top) / rect.height) * 100));
      snapBackPosRef.current = { leftPct, topPct };
      setOrbMode('docked');
      onSetOrbState({ mode: 'docked', x: 0, y: 0, vx: 0, vy: 0 });
    } else {
      const vx = Math.max(-5, Math.min(5, velRef.current.vx));
      const vy = Math.max(-5, Math.min(5, velRef.current.vy));
      setOrbMode('roaming');
      onSetOrbState({
        mode: 'roaming',
        x: clientX,
        y: clientY,
        vx: Math.hypot(vx, vy) < 0.4 ? (Math.random() - 0.5) * 2.4 : vx,
        vy: Math.hypot(vx, vy) < 0.4 ? -1.4 : vy,
      });
    }
  };

  const handleCradlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (orbMode === 'recalling') return;

    if (orbMode === 'roaming') {
      // Slide roaming ball smoothly back into the cradle center
      solarisAudio.playMechClick(720, 0.08);
      const rect = orbRef.current?.getBoundingClientRect();
      if (!rect) {
        setOrbMode('docked');
        onSetOrbState({ mode: 'docked', x: 0, y: 0, vx: 0, vy: 0 });
        return;
      }
      const targetX = rect.left + rect.width * 0.5;
      const targetY = rect.top + rect.height * 0.44;
      setOrbMode('recalling');
      onSetOrbState({
        mode: 'recalling',
        x: posRef.current.x,
        y: posRef.current.y,
        targetX,
        targetY,
      });
      return;
    }

    draggingRef.current = true;
    velRef.current = {
      vx: 0,
      vy: 0,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
    };
    posRef.current = { x: e.clientX, y: e.clientY };
    setOrbMode('dragging');
    e.currentTarget.setPointerCapture(e.pointerId);
    handleDragMove(e.clientX, e.clientY, true);
  };

  const handleSkyBallPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    draggingRef.current = true;
    velRef.current = {
      vx: 0,
      vy: 0,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
    };
    posRef.current = { x: e.clientX, y: e.clientY };
    setOrbMode('dragging');
    e.currentTarget.setPointerCapture(e.pointerId);
    handleDragMove(e.clientX, e.clientY, true);
  };

  return (
    <>
      <div
        ref={orbRef}
        className={
          orbMode === 'docked'
            ? 'orb'
            : orbMode === 'dragging'
              ? 'orb drag escaped'
              : orbMode === 'recalling'
                ? 'orb escaped recalling'
                : 'orb escaped'
        }
        role="application"
        aria-label={
          orbMode === 'roaming'
            ? 'Orb roaming in twilight sky — click to recall'
            : orbMode === 'recalling'
              ? 'Orb sliding back to cradle'
              : 'Harmonic swirl and pluck pad — drag outside to roam'
        }
        onPointerDown={handleCradlePointerDown}
        onPointerMove={(e) => {
          if (draggingRef.current) handleDragMove(e.clientX, e.clientY, false);
        }}
        onPointerUp={(e) => finishDrag(e.clientX, e.clientY)}
        onPointerCancel={(e) => finishDrag(e.clientX, e.clientY)}
      >
        {orbMode === 'docked' && <div ref={dockedDotRef} className="orb-dot" />}
      </div>

      {orbMode !== 'docked' &&
        createPortal(
          <div
            ref={escapedDotRef}
            className={
              orbMode === 'dragging' ? 'orb-dot-roam dragging' : 'orb-dot-roam'
            }
            title="Drag to gather light orbs or drop back in swirl · pluck"
            onPointerDown={handleSkyBallPointerDown}
            onPointerMove={(e) => {
              if (draggingRef.current) handleDragMove(e.clientX, e.clientY, false);
            }}
            onPointerUp={(e) => finishDrag(e.clientX, e.clientY)}
            onPointerCancel={(e) => finishDrag(e.clientX, e.clientY)}
          />,
          document.body,
        )}
    </>
  );
}
