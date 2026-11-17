import { useEffect, useImperativeHandle, useRef } from 'react';
import type { GravityWell, OrbControlState, RippleOptions } from '../types/solaris';

export interface TwilightWorldHandle {
  spawnRipple: (opts: RippleOptions) => void;
  setGravityWell: (well: GravityWell | null) => void;
  setOrbState: (state: OrbControlState) => void;
}

interface TwilightWorldProps {
  brightness: number;
  onOrbFrame?: (x: number, y: number, gatheredCount: number) => void;
  onOrbGather?: (count: number, whileDragging: boolean) => void;
  onOrbRecalled?: () => void;
  ref?: React.Ref<TwilightWorldHandle>;
}

interface RippleInternal {
  x: number;
  y: number;
  r: number;
  alpha: number;
  sp: number;
  fade: number;
}

interface LightOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ph: number;
  hue: 'gold' | 'rose' | 'ivory';
  orbiting: boolean;
  orbitAngle: number;
  orbitDist: number;
  orbitSpeed: number;
}

const MAX_ORBIT_ORBS = 12;

export function TwilightWorld({
  brightness,
  onOrbFrame,
  onOrbGather,
  onOrbRecalled,
  ref,
}: TwilightWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ripplesRef = useRef<RippleInternal[]>([]);
  const wellRef = useRef<GravityWell | null>(null);
  const orbRef = useRef<OrbControlState & { vx: number; vy: number; targetX: number; targetY: number }>({
    mode: 'docked',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    targetX: 0,
    targetY: 0,
  });
  const releaseOrbsFlagRef = useRef(false);

  const onOrbFrameRef = useRef(onOrbFrame);
  const onOrbGatherRef = useRef(onOrbGather);
  const onOrbRecalledRef = useRef(onOrbRecalled);
  useEffect(() => {
    onOrbFrameRef.current = onOrbFrame;
    onOrbGatherRef.current = onOrbGather;
    onOrbRecalledRef.current = onOrbRecalled;
  }, [onOrbFrame, onOrbGather, onOrbRecalled]);

  useImperativeHandle(
    ref,
    () => ({
      spawnRipple(opts: RippleOptions) {
        ripplesRef.current.push({
          x: opts.x,
          y: opts.y,
          r: opts.r ?? 24,
          alpha: opts.alpha ?? 0.85,
          sp: opts.sp ?? 5.5,
          fade: opts.fade ?? 0.016,
        });
      },
      setGravityWell(well: GravityWell | null) {
        wellRef.current = well;
      },
      setOrbState(next: OrbControlState) {
        const prevMode = orbRef.current.mode;
        orbRef.current = {
          mode: next.mode,
          x: next.mode === 'recalling' ? orbRef.current.x || next.x : next.x,
          y: next.mode === 'recalling' ? orbRef.current.y || next.y : next.y,
          vx: next.vx ?? orbRef.current.vx,
          vy: next.vy ?? orbRef.current.vy,
          targetX: next.targetX ?? orbRef.current.targetX,
          targetY: next.targetY ?? orbRef.current.targetY,
        };
        if (next.mode === 'docked' && prevMode !== 'docked') {
          releaseOrbsFlagRef.current = true;
          wellRef.current = null;
        }
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const pointer = { x: W * 0.5, y: H * 0.5, active: false };
    const halo = { x: W * 0.5, y: H * 0.5 };
    const softWake: Array<{ x: number; y: number; life: number }> = [];

    const onMouseMove = (e: MouseEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      softWake.push({ x: e.clientX, y: e.clientY, life: 1 });
      if (softWake.length > 14) softWake.shift();
    };
    window.addEventListener('mousemove', onMouseMove);

    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.62,
      r: 0.7 + Math.random() * 1.7,
      twinkle: Math.random() * Math.PI * 2,
    }));

    const shooters: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];

    const lanterns = Array.from({ length: 11 }, () => ({
      x: Math.random() * W,
      y: H * (0.3 + Math.random() * 0.6),
      s: 0.6 + Math.random() * 0.9,
      ph: Math.random() * 6.28,
      v: 0.18 + Math.random() * 0.3,
      vx: 0,
      vy: 0,
    }));

    const embers = Array.from({ length: 50 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1.2 + Math.random() * 2.5,
      ph: Math.random() * 6.28,
      v: 0.3 + Math.random() * 0.7,
      rot: Math.random() * 6.28,
      vx: 0,
      vy: 0,
    }));

    const hues: Array<LightOrb['hue']> = ['gold', 'ivory', 'rose'];
    const createLightOrb = (fromEdge = false): LightOrb => ({
      x: fromEdge ? (Math.random() < 0.5 ? -20 : W + 20) : Math.random() * W,
      y: H * (0.14 + Math.random() * 0.66),
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.3,
      r: 3.6 + Math.random() * 3.4,
      ph: Math.random() * Math.PI * 2,
      hue: hues[Math.floor(Math.random() * hues.length)],
      orbiting: false,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitDist: 24 + Math.random() * 28,
      orbitSpeed: (Math.random() < 0.5 ? 1 : -1) * (0.028 + Math.random() * 0.022),
    });

    const lightOrbs: LightOrb[] = Array.from({ length: 16 }, () => createLightOrb(false));

    let trainX = W * 0.2;
    let cloudOffset = 0;
    let tick = 0;
    let rafId = 0;

    function pull(o: { x: number; y: number; vx: number; vy: number }, strength: number) {
      const activeOrb = orbRef.current;
      const well =
        activeOrb.mode !== 'docked'
          ? { x: activeOrb.x, y: activeOrb.y, s: 1.8 }
          : wellRef.current;
      if (!well) return;
      const dx = well.x - o.x;
      const dy = well.y - o.y;
      const d = Math.hypot(dx, dy) + 30;
      const f = (well.s * strength * 900) / (d * d + 2000);
      o.vx += (dx / d) * f * 40;
      o.vy += (dy / d) * f * 40;
    }

    function draw() {
      if (!ctx) return;
      tick++;

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0c0612');
      sky.addColorStop(0.36, '#2b103b');
      sky.addColorStop(0.7, '#8f2447');
      sky.addColorStop(0.9, '#e63956');
      sky.addColorStop(1, '#ffb3c1');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      const px = (pointer.x - W * 0.5) * 0.03;
      const py = (pointer.y - H * 0.5) * 0.02;

      for (const s of stars) {
        s.twinkle += 0.025;
        ctx.globalAlpha = 0.35 + Math.sin(s.twinkle) * 0.35;
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath();
        ctx.arc(s.x + px * 0.4, s.y + py * 0.4, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (Math.random() < 0.004 && shooters.length < 2) {
        shooters.push({
          x: Math.random() * W * 0.8,
          y: Math.random() * H * 0.3,
          vx: 9 + Math.random() * 5,
          vy: 3 + Math.random() * 3,
          life: 1,
        });
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.014;
        if (s.life <= 0) {
          shooters.splice(i, 1);
          continue;
        }
        const tx = s.x - s.vx * 14;
        const ty = s.y - s.vy * 14;
        const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
        g.addColorStop(0, `rgba(255,241,242,${s.life})`);
        g.addColorStop(0.4, `rgba(255,117,143,${s.life * 0.5})`);
        g.addColorStop(1, 'rgba(255,117,143,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${s.life})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      cloudOffset += 0.16;
      ctx.fillStyle = 'rgba(255, 194, 209, 0.16)';
      for (let i = 0; i < 7; i++) {
        const cx = ((i * 320 + cloudOffset) % (W + 400)) - 200 + px * 0.8;
        const cy = H * 0.56 + (i % 3) * 28 + py * 0.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 140, 32, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#180b24';
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, H * 0.78 + py);
      ctx.quadraticCurveTo(W * 0.28, H * 0.69 + py, W * 0.55, H * 0.77 + py);
      ctx.quadraticCurveTo(W * 0.82, H * 0.83 + py, W, H * 0.74 + py);
      ctx.lineTo(W, H);
      ctx.fill();

      trainX += 0.65;
      if (trainX > W + 450) trainX = -450;
      const bridgeY = H * 0.82 + py * 1.3;
      const tY = bridgeY - 24;

      const water = ctx.createLinearGradient(0, bridgeY + 14, 0, H);
      water.addColorStop(0, '#12081c');
      water.addColorStop(1, '#3a1233');
      ctx.fillStyle = water;
      ctx.fillRect(0, bridgeY + 14, W, H - bridgeY);
      for (let wx = 14; wx < 355; wx += 28) {
        for (let k = 0; k < 7; k++) {
          const wob = Math.sin(tick * 0.05 + k * 1.3 + wx) * (3 + k * 1.4);
          ctx.fillStyle = `rgba(255,209,102,${0.28 - k * 0.035})`;
          ctx.fillRect(trainX + wx + wob, bridgeY + 20 + k * 8, 18 - k, 3);
        }
      }

      ctx.fillStyle = '#0f0717';
      ctx.fillRect(0, bridgeY, W, 14);
      for (let bx = 40; bx < W; bx += 160) {
        ctx.fillRect(bx + px * 1.3, bridgeY + 14, 16, H - bridgeY);
      }

      ctx.fillStyle = '#140a1f';
      ctx.fillRect(trainX, tY, 380, 24);
      ctx.fillStyle = '#ffd166';
      for (let wx = 14; wx < 355; wx += 28) {
        ctx.fillRect(trainX + wx, tY + 6, 18, 9);
      }

      const pole1X = W * 0.14 + px * 1.8;
      const pole2X = W * 0.86 + px * 1.8;
      ctx.fillStyle = '#0b0510';
      ctx.fillRect(pole1X, H * 0.28, 7, H * 0.72);
      ctx.fillRect(pole1X - 24, H * 0.34, 54, 4);
      ctx.fillRect(pole2X, H * 0.32, 7, H * 0.68);
      ctx.fillRect(pole2X - 24, H * 0.38, 54, 4);

      ctx.strokeStyle = 'rgba(11, 5, 16, 0.82)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.26);
      ctx.quadraticCurveTo(pole1X * 0.5, H * 0.39, pole1X - 20, H * 0.34);
      ctx.quadraticCurveTo(W * 0.5, H * 0.52 + py * 2, pole2X - 20, H * 0.38);
      ctx.quadraticCurveTo(W * 0.94, H * 0.44, W, H * 0.35);
      ctx.stroke();

      for (const l of lanterns) {
        pull(l, 1);
        l.vx *= 0.94;
        l.vy *= 0.94;
        l.ph += 0.01;
        l.x += Math.sin(l.ph) * 0.35 + l.vx + px * 0.01;
        l.y += -l.v + l.vy;
        if (l.y < -40) {
          l.y = H + 30;
          l.x = Math.random() * W;
        }
        const r = 26 * l.s;
        const glow = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r * 2.6);
        glow.addColorStop(0, 'rgba(255,183,3,.55)');
        glow.addColorStop(0.4, 'rgba(255,117,143,.18)');
        glow.addColorStop(1, 'rgba(255,117,143,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(l.x, l.y, r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,214,150,.9)';
        ctx.beginPath();
        ctx.ellipse(l.x, l.y, r * 0.38, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const e of embers) {
        pull(e, 1.4);
        e.vx *= 0.95;
        e.vy *= 0.95;
        e.ph += 0.02;
        e.rot += 0.02;
        e.x += Math.sin(e.ph) * 0.5 + 0.22 + e.vx;
        e.y += -e.v * 0.35 + e.vy;
        if (e.y < -10) {
          e.y = H + 10;
          e.x = Math.random() * W;
        }
        if (e.x > W + 10) e.x = -10;
        ctx.fillStyle = `rgba(255,${150 + ((e.r * 25) | 0)},170,${0.42 + Math.sin(e.ph * 2) * 0.22})`;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.r * 1.5, e.r * 0.8, e.rot, 0, Math.PI * 2);
        ctx.fill();
      }

      // Autonomous roaming & light-orb gathering physics
      const activeOrb = orbRef.current;
      if (releaseOrbsFlagRef.current) {
        releaseOrbsFlagRef.current = false;
        let hadOrbiting = false;
        for (const lo of lightOrbs) {
          if (lo.orbiting) {
            hadOrbiting = true;
            lo.orbiting = false;
            lo.vx = Math.cos(lo.orbitAngle) * (2.6 + Math.random() * 2.2);
            lo.vy = Math.sin(lo.orbitAngle) * (2.6 + Math.random() * 2.2);
          }
        }
        if (hadOrbiting) {
          ripplesRef.current.push({
            x: activeOrb.x || W * 0.5,
            y: activeOrb.y || H * 0.5,
            r: 18,
            alpha: 0.75,
            sp: 5.5,
            fade: 0.018,
          });
        }
      }

      if (activeOrb.mode === 'roaming') {
        // Seek nearest free light orb gently
        let nearest: LightOrb | null = null;
        let bestDist = Infinity;
        for (const lo of lightOrbs) {
          if (lo.orbiting) continue;
          const d = Math.hypot(lo.x - activeOrb.x, lo.y - activeOrb.y);
          if (d < bestDist) {
            bestDist = d;
            nearest = lo;
          }
        }

        if (nearest) {
          const dx = nearest.x - activeOrb.x;
          const dy = nearest.y - activeOrb.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          activeOrb.vx += (dx / d) * 0.16;
          activeOrb.vy += (dy / d) * 0.16;
        } else {
          // Gentle organic figure-eight drift when holding a full constellation
          activeOrb.vx += Math.cos(tick * 0.018) * 0.12;
          activeOrb.vy += Math.sin(tick * 0.025) * 0.1;
        }

        // Gentle swirl noise
        activeOrb.vx += Math.sin(tick * 0.03 + activeOrb.y * 0.01) * 0.045;
        activeOrb.vy += Math.cos(tick * 0.027 + activeOrb.x * 0.01) * 0.045;

        const speed = Math.hypot(activeOrb.vx, activeOrb.vy);
        if (speed > 3.8) {
          activeOrb.vx = (activeOrb.vx / speed) * 3.8;
          activeOrb.vy = (activeOrb.vy / speed) * 3.8;
        }
        activeOrb.vx *= 0.985;
        activeOrb.vy *= 0.985;

        activeOrb.x += activeOrb.vx;
        activeOrb.y += activeOrb.vy;

        const pad = 54;
        if (activeOrb.x < pad) {
          activeOrb.x = pad;
          activeOrb.vx = Math.abs(activeOrb.vx) * 0.8 + 0.6;
        } else if (activeOrb.x > W - pad) {
          activeOrb.x = W - pad;
          activeOrb.vx = -Math.abs(activeOrb.vx) * 0.8 - 0.6;
        }
        if (activeOrb.y < pad) {
          activeOrb.y = pad;
          activeOrb.vy = Math.abs(activeOrb.vy) * 0.8 + 0.6;
        } else if (activeOrb.y > H - pad) {
          activeOrb.y = H - pad;
          activeOrb.vy = -Math.abs(activeOrb.vy) * 0.8 - 0.6;
        }
      } else if (activeOrb.mode === 'recalling') {
        const dx = activeOrb.targetX - activeOrb.x;
        const dy = activeOrb.targetY - activeOrb.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 3) {
          activeOrb.x = activeOrb.targetX;
          activeOrb.y = activeOrb.targetY;
          activeOrb.mode = 'docked';
          activeOrb.vx = 0;
          activeOrb.vy = 0;
          releaseOrbsFlagRef.current = true;
          wellRef.current = null;
          onOrbRecalledRef.current?.();
        } else {
          const step = Math.min(dist, Math.max(4.5, dist * 0.11));
          activeOrb.x += (dx / dist) * step;
          activeOrb.y += (dy / dist) * step;
        }
      }

      // Update & draw floating light orbs
      let orbitingCount = 0;
      for (const lo of lightOrbs) {
        if (lo.orbiting) orbitingCount++;
      }

      for (let idx = 0; idx < lightOrbs.length; idx++) {
        const lo = lightOrbs[idx];
        lo.ph += 0.04;

        if (activeOrb.mode !== 'docked') {
          if (lo.orbiting) {
            lo.orbitAngle += lo.orbitSpeed;
            const targetX = activeOrb.x + Math.cos(lo.orbitAngle) * lo.orbitDist;
            const targetY = activeOrb.y + Math.sin(lo.orbitAngle) * lo.orbitDist;
            lo.x += (targetX - lo.x) * 0.18;
            lo.y += (targetY - lo.y) * 0.18;
          } else if (activeOrb.mode !== 'recalling') {
            const dx = activeOrb.x - lo.x;
            const dy = activeOrb.y - lo.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 56) {
              if (orbitingCount >= MAX_ORBIT_ORBS) {
                // Recycle oldest orbiting orb softly back to the sky
                const oldest = lightOrbs.find((item) => item.orbiting);
                if (oldest) {
                  Object.assign(oldest, createLightOrb(true));
                  orbitingCount--;
                }
              }
              lo.orbiting = true;
              lo.orbitAngle = Math.atan2(lo.y - activeOrb.y, lo.x - activeOrb.x);
              orbitingCount++;
              ripplesRef.current.push({
                x: lo.x,
                y: lo.y,
                r: 6,
                alpha: 0.65,
                sp: 3.4,
                fade: 0.032,
              });
              onOrbGatherRef.current?.(orbitingCount, activeOrb.mode === 'dragging');
            } else if (dist < 260) {
              const pullStrength = (1 - dist / 260) * 0.42;
              lo.vx += (dx / dist) * pullStrength;
              lo.vy += (dy / dist) * pullStrength;
            }
          }
        } else if (lo.orbiting) {
          lo.orbiting = false;
        }

        if (!lo.orbiting) {
          lo.vx = lo.vx * 0.96 + Math.sin(lo.ph * 0.7) * 0.018;
          lo.vy = lo.vy * 0.96 + Math.cos(lo.ph * 0.55) * 0.015 - 0.008;
          lo.x += lo.vx;
          lo.y += lo.vy;
          if (lo.x < -30) lo.x = W + 25;
          if (lo.x > W + 30) lo.x = -25;
          if (lo.y < -30) lo.y = H * 0.8;
          if (lo.y > H + 30) lo.y = H * 0.2;
        }

        const pulse = 0.85 + Math.sin(lo.ph) * 0.15;
        const glowR = lo.r * (lo.orbiting ? 4.4 : 3.6) * pulse;
        const coreColor =
          lo.hue === 'gold'
            ? 'rgba(255, 224, 130, 0.95)'
            : lo.hue === 'rose'
              ? 'rgba(255, 165, 195, 0.92)'
              : 'rgba(255, 248, 232, 0.95)';
        const haloColor =
          lo.hue === 'gold'
            ? 'rgba(255, 183, 3, 0.34)'
            : lo.hue === 'rose'
              ? 'rgba(255, 117, 143, 0.32)'
              : 'rgba(255, 220, 170, 0.3)';

        if (lo.orbiting && activeOrb.mode !== 'docked') {
          ctx.strokeStyle = 'rgba(255, 209, 102, 0.22)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(activeOrb.x, activeOrb.y);
          ctx.lineTo(lo.x, lo.y);
          ctx.stroke();
        }

        const lg = ctx.createRadialGradient(lo.x, lo.y, 0, lo.x, lo.y, glowR);
        lg.addColorStop(0, coreColor);
        lg.addColorStop(0.35, haloColor);
        lg.addColorStop(1, 'rgba(255, 183, 3, 0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(lo.x, lo.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lo.x, lo.y, lo.r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      if (activeOrb.mode !== 'docked') {
        const auraR = 34 + orbitingCount * 3.5;
        const og = ctx.createRadialGradient(
          activeOrb.x,
          activeOrb.y,
          2,
          activeOrb.x,
          activeOrb.y,
          auraR,
        );
        og.addColorStop(0, 'rgba(255, 235, 165, 0.48)');
        og.addColorStop(0.45, 'rgba(255, 117, 143, 0.18)');
        og.addColorStop(1, 'rgba(255, 117, 143, 0)');
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(activeOrb.x, activeOrb.y, auraR, 0, Math.PI * 2);
        ctx.fill();

        onOrbFrameRef.current?.(activeOrb.x, activeOrb.y, orbitingCount);
      }

      if (pointer.active) {
        halo.x += (pointer.x - halo.x) * 0.28;
        halo.y += (pointer.y - halo.y) * 0.28;

        for (let i = softWake.length - 1; i >= 0; i--) {
          const w = softWake[i];
          w.life -= 0.07;
          if (w.life <= 0) {
            softWake.splice(i, 1);
            continue;
          }
          ctx.fillStyle = `rgba(255, 183, 3, ${w.life * 0.14})`;
          ctx.beginPath();
          ctx.arc(w.x, w.y, 10 * w.life, 0, Math.PI * 2);
          ctx.fill();
        }

        const hGrad = ctx.createRadialGradient(halo.x, halo.y, 1, halo.x, halo.y, 26);
        hGrad.addColorStop(0, 'rgba(255, 224, 130, 0.35)');
        hGrad.addColorStop(0.5, 'rgba(255, 117, 143, 0.12)');
        hGrad.addColorStop(1, 'rgba(255, 117, 143, 0)');
        ctx.fillStyle = hGrad;
        ctx.beginPath();
        ctx.arc(halo.x, halo.y, 26, 0, Math.PI * 2);
        ctx.fill();
      }

      const ripples = ripplesRef.current;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += rp.sp;
        rp.alpha -= rp.fade;
        if (rp.alpha <= 0) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(255, 183, 3, ${rp.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (wellRef.current) {
        wellRef.current.s *= 0.995;
        if (wellRef.current.s < 0.05) wellRef.current = null;
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      id="world-canvas"
      ref={canvasRef}
      style={{ filter: `brightness(${brightness})` }}
    />
  );
}
