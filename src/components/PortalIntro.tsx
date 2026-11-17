import { useEffect, useRef, useState } from 'react';
import { solarisAudio } from '../audio/solarisAudio';

interface PortalIntroProps {
  entered: boolean;
  initialGoal: string;
  onEnter: (goal: string) => void;
}

export function PortalIntro({ entered, initialGoal, onEnter }: PortalIntroProps) {
  const [goalInput, setGoalInput] = useState(
    initialGoal === 'Deep Work Session' ? '' : initialGoal,
  );
  const [exiting, setExiting] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gate1Ref = useRef<HTMLDivElement | null>(null);
  const gate2Ref = useRef<HTMLDivElement | null>(null);
  const gate3Ref = useRef<HTMLDivElement | null>(null);
  const gridFloorRef = useRef<HTMLDivElement | null>(null);
  const gridCeilRef = useRef<HTMLDivElement | null>(null);
  const scrollFillRef = useRef<HTMLDivElement | null>(null);
  const scrollLabelRef = useRef<HTMLSpanElement | null>(null);
  const goalInputRef = useRef<HTMLInputElement | null>(null);

  const targetDepthRef = useRef(0);
  const currentDepthRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (entered) {
      doneRef.current = true;
      return;
    }

    let rafId = 0;

    function renderTunnel() {
      if (doneRef.current) return;

      currentDepthRef.current += (targetDepthRef.current - currentDepthRef.current) * 0.12;
      const d = currentDepthRef.current;
      const progress = Math.min(1, Math.max(0, d / 1400));

      if (scrollFillRef.current) {
        scrollFillRef.current.style.width = `${Math.round(progress * 100)}%`;
      }

      const gridShift = (d * 0.6) % 48;
      if (gridFloorRef.current) {
        gridFloorRef.current.style.backgroundPosition = `0px ${gridShift}px`;
      }
      if (gridCeilRef.current) {
        gridCeilRef.current.style.backgroundPosition = `0px ${-gridShift}px`;
      }

      if (gate1Ref.current) {
        const z1 = d;
        const op1 = z1 < 250 ? 1 : Math.max(0, 1 - (z1 - 250) / 320);
        const visible = op1 > 0.01 && z1 <= 750;
        gate1Ref.current.style.visibility = visible ? 'visible' : 'hidden';
        gate1Ref.current.style.transform = `translate3d(0, 0, ${Math.min(z1, 750)}px)`;
        gate1Ref.current.style.opacity = String(op1);
        gate1Ref.current.style.pointerEvents = op1 > 0.4 && visible ? 'auto' : 'none';
      }

      if (gate2Ref.current) {
        const z2 = -700 + d;
        const op2 =
          z2 < -550
            ? 0
            : z2 < 180
              ? Math.min(1, (z2 + 550) / 350)
              : Math.max(0, 1 - (z2 - 180) / 300);
        const visible = op2 > 0.01 && z2 <= 750;
        gate2Ref.current.style.visibility = visible ? 'visible' : 'hidden';
        gate2Ref.current.style.transform = `translate3d(0, 0, ${Math.min(z2, 750)}px)`;
        gate2Ref.current.style.opacity = String(op2);
        gate2Ref.current.style.pointerEvents = op2 > 0.4 && visible ? 'auto' : 'none';
      }

      if (gate3Ref.current) {
        const z3 = -1400 + d;
        const op3 = z3 < -650 ? 0 : Math.min(1, (z3 + 650) / 500);
        gate3Ref.current.style.visibility = op3 > 0.01 ? 'visible' : 'hidden';
        gate3Ref.current.style.transform = `translate3d(0, 0, ${z3}px)`;
        gate3Ref.current.style.opacity = String(op3);
        gate3Ref.current.style.pointerEvents = z3 > -180 ? 'auto' : 'none';

        if (scrollLabelRef.current) {
          scrollLabelRef.current.textContent =
            progress > 0.92 ? 'OBJECTIVE DECK READY' : 'SCROLL TO ENTER ↓';
        }
        if (
          progress > 0.92 &&
          z3 > -40 &&
          goalInputRef.current &&
          document.activeElement !== goalInputRef.current
        ) {
          goalInputRef.current.focus({ preventScroll: true });
        }
      }

      rafId = requestAnimationFrame(renderTunnel);
    }

    rafId = requestAnimationFrame(renderTunnel);

    const overlay = overlayRef.current;
    let touchStartY = 0;

    const onWheel = (e: WheelEvent) => {
      if (doneRef.current) return;
      e.preventDefault();
      targetDepthRef.current = Math.min(
        1400,
        Math.max(0, targetDepthRef.current + e.deltaY * 1.35),
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (doneRef.current) return;
      const dy = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      targetDepthRef.current = Math.min(
        1400,
        Math.max(0, targetDepthRef.current + dy * 2.5),
      );
    };

    overlay?.addEventListener('wheel', onWheel, { passive: false });
    overlay?.addEventListener('touchstart', onTouchStart, { passive: true });
    overlay?.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      overlay?.removeEventListener('wheel', onWheel);
      overlay?.removeEventListener('touchstart', onTouchStart);
      overlay?.removeEventListener('touchmove', onTouchMove);
    };
  }, [entered]);

  const handleJump = () => {
    solarisAudio.playMechClick(760);
    targetDepthRef.current = 1400;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (doneRef.current) return;
    doneRef.current = true;
    solarisAudio.playBootChime();
    setExiting(true);
    onEnter(goalInput.trim() || 'Deep Work Session');
  };

  return (
    <>
      <div className="cinema-bar top">
        <span>SOLARIS // CHRONO-SYSTEM</span>
        <span>TWILIGHT EDITION</span>
      </div>
      <div className="cinema-bar bottom">
        <span>EVENING EXPRESS • 24FPS</span>
        <span>SCROLL TO DIVE IN</span>
      </div>

      <div
        id="intro-overlay"
        ref={overlayRef}
        className={exiting || entered ? 'crt-exit' : undefined}
        aria-hidden={entered}
      >
        <div className="arcade-grid-ceil" ref={gridCeilRef} />
        <div className="arcade-grid-floor" ref={gridFloorRef} />

        <div className="tunnel-world">
          <div className="z-gate gate-arch" ref={gate1Ref}>
            <div className="gate-tag">★ GATE 01 // THE OUTER NOISE ★</div>
            <h2 className="gate-title">LEAVE THE STATIC BEHIND</h2>
            <p className="gate-desc">
              “Notifications, open tabs, and restless hours stay outside this threshold.”
            </p>
          </div>

          <div className="z-gate gate-arch amber" ref={gate2Ref}>
            <div className="gate-tag">✦ GATE 02 // TWILIGHT STILLNESS ✦</div>
            <h2 className="gate-title">ONE ROOM. ONE OBJECTIVE.</h2>
            <p className="gate-desc">
              “The evening express passes over the viaduct. Your mind stays anchored here.”
            </p>
          </div>

          <div className="z-gate gate-terminal" ref={gate3Ref}>
            <div className="arcade-badge">★ FOCUS PROTOCOL • READY ★</div>
            <h1 className="terminal-headline">Lock in your session.</h1>
            <p className="terminal-sub">
              Load your single intention into the chrono-deck to enter the sanctuary.
            </p>
            <form className="entry-form" onSubmit={handleSubmit}>
              <input
                ref={goalInputRef}
                type="text"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="Enter your single objective..."
                autoComplete="off"
              />
              <button type="submit" className="arcade-start-btn">
                START SESSION
              </button>
            </form>
          </div>
        </div>

        <div className="scroll-hud">
          <span ref={scrollLabelRef}>SCROLL TO ENTER ↓</span>
          <div className="scroll-pill-bar">
            <div className="scroll-pill-fill" ref={scrollFillRef} />
          </div>
          <button type="button" className="skip-intro-btn" onClick={handleJump}>
            JUMP ↵
          </button>
        </div>
      </div>
    </>
  );
}
