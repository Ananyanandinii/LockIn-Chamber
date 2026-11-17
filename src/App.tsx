import { useCallback, useEffect, useRef, useState } from 'react';
import { solarisAudio } from './audio/solarisAudio';
import { AstrolabeClock } from './components/AstrolabeClock';
import { AudioDeck } from './components/AudioDeck';
import { HeaderBar } from './components/HeaderBar';
import { PortalIntro } from './components/PortalIntro';
import { PresenceWitness } from './components/PresenceWitness';
import { SessionLedger } from './components/SessionLedger';
import { ThoughtVault } from './components/ThoughtVault';
import { TwilightWorld, type TwilightWorldHandle } from './components/TwilightWorld';
import type {
  CamMode,
  ClockStatus,
  LedgerStats,
  OrbControlState,
  RippleOptions,
  ThoughtItem,
} from './types/solaris';

const LEDGER_KEY = 'solaris_analog_ledger';
const VAULT_KEY = 'solaris_thought_vault';

const QUOTES = [
  '“What you refuse to split your attention on becomes yours.”',
  '“The clock only measures hours; stillness measures depth.”',
  '“Every quiet minute here buys freedom outside this room.”',
  '“Do not rush the page; let the mind settle like dusk.”',
];

const OVERTIME_QUOTE = '“Momentum begins the moment the clock stops demanding.”';

function loadLedger(): LedgerStats {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) return { mins: 0, flow: 0, blocks: 0 };
    const parsed = JSON.parse(raw) as Partial<LedgerStats>;
    return {
      mins: typeof parsed.mins === 'number' ? parsed.mins : 0,
      flow: typeof parsed.flow === 'number' ? parsed.flow : 0,
      blocks: typeof parsed.blocks === 'number' ? parsed.blocks : 0,
    };
  } catch {
    return { mins: 0, flow: 0, blocks: 0 };
  }
}

function loadVault(): ThoughtItem[] {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function App() {
  const worldRef = useRef<TwilightWorldHandle | null>(null);

  const [entered, setEntered] = useState(false);
  const [goal, setGoal] = useState('Deep Work Session');
  const [drifts, setDrifts] = useState(0);
  const [tabDimmed, setTabDimmed] = useState(false);

  // Audio state
  const [brownOn, setBrownOn] = useState(false);
  const [rainOn, setRainOn] = useState(false);
  const [brownVol, setBrownVol] = useState(0.6);
  const [rainVol, setRainVol] = useState(0.45);
  const [warmth, setWarmth] = useState(0.42);
  const [micOn, setMicOn] = useState(false);
  const [audioAutoPaused, setAudioAutoPaused] = useState(false);

  // Chronometer state
  const [durationMins, setDurationMins] = useState(25);
  const [remSec, setRemSec] = useState(25 * 60);
  const [overSec, setOverSec] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [running, setRunning] = useState(false);
  const [pausedByAway, setPausedByAway] = useState(false);
  const [clockStatus, setClockStatus] = useState<ClockStatus>('STANDBY');
  const [quoteIdx, setQuoteIdx] = useState(0);

  // Persistence
  const [ledger, setLedger] = useState<LedgerStats>(loadLedger);
  const [vaultItems, setVaultItems] = useState<ThoughtItem[]>(loadVault);
  const [camMode, setCamMode] = useState<CamMode>('off');

  useEffect(() => {
    try {
      localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    } catch {
      // Ignore storage quota errors
    }
  }, [ledger]);

  useEffect(() => {
    try {
      localStorage.setItem(VAULT_KEY, JSON.stringify(vaultItems));
    } catch {
      // Ignore storage quota errors
    }
  }, [vaultItems]);

  // Sync audio parameters with Web Audio engine
  useEffect(() => {
    solarisAudio.syncState({
      brownOn,
      rainOn,
      brownVol,
      rainVol,
      autoPaused: audioAutoPaused,
      warmth,
    });
  }, [brownOn, rainOn, brownVol, rainVol, audioAutoPaused, warmth]);

  // Cleanup mic shield on unmount
  useEffect(() => {
    return () => solarisAudio.stopMicShield();
  }, []);

  // Rotating quotes every 18s
  useEffect(() => {
    const id = window.setInterval(() => {
      setQuoteIdx((idx) => (idx + 1) % QUOTES.length);
    }, 18000);
    return () => window.clearInterval(id);
  }, []);

  // Tab visibility drift detector
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && running) {
        setDrifts((d) => d + 1);
        setTabDimmed(true);
      } else {
        setTabDimmed(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [running]);

  // 1-second chronometer tick using ref mirror so StrictMode never double-triggers side effects
  const clockSnapshotRef = useRef({ remSec, overSec, isOvertime });
  useEffect(() => {
    clockSnapshotRef.current = { remSec, overSec, isOvertime };
  }, [remSec, overSec, isOvertime]);

  useEffect(() => {
    if (!running) return;

    const intervalId = window.setInterval(() => {
      const snap = clockSnapshotRef.current;

      if (!snap.isOvertime) {
        if (snap.remSec > 0) {
          const next = snap.remSec - 1;
          setRemSec(next);
          if (next % 60 === 0) {
            setLedger((prev) => ({ ...prev, mins: prev.mins + 1 }));
          }
        } else {
          setIsOvertime(true);
          setClockStatus('FLOW OVERTIME');
          setLedger((prev) => ({ ...prev, blocks: prev.blocks + 1 }));
          solarisAudio.playSingingBowl();
          worldRef.current?.spawnRipple({
            x: window.innerWidth * 0.5,
            y: window.innerHeight * 0.5,
            r: 40,
            alpha: 0.9,
          });
        }
      } else {
        const nextOver = snap.overSec + 1;
        setOverSec(nextOver);
        if (nextOver % 60 === 0) {
          setLedger((prev) => ({ ...prev, flow: prev.flow + 1 }));
        }
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [running]);

  const handleToggleRun = () => {
    solarisAudio.playMechClick(500);
    if (running) {
      setRunning(false);
      setPausedByAway(false);
      setClockStatus('PAUSED');
    } else {
      setRunning(true);
      setPausedByAway(false);
      setClockStatus(isOvertime ? 'FLOW OVERTIME' : 'LOCKED IN');
    }
  };

  const handleReset = (nextMins = durationMins) => {
    solarisAudio.playMechClick(420);
    setRunning(false);
    setPausedByAway(false);
    setIsOvertime(false);
    setOverSec(0);
    setRemSec(nextMins * 60);
    setClockStatus('STANDBY');
  };

  const handleSelectDuration = (mins: number) => {
    solarisAudio.playMechClick(650);
    setDurationMins(mins);
    handleReset(mins);
  };

  // Presence Witness callbacks
  const handleAway = useCallback(() => {
    if (running) {
      setPausedByAway(true);
      setRunning(false);
      setClockStatus('PAUSED — AWAY');
    }
    if (brownOn || rainOn) {
      setAudioAutoPaused(true);
    }
  }, [running, brownOn, rainOn]);

  const handleReturn = useCallback(() => {
    if (pausedByAway) {
      setPausedByAway(false);
      setRunning(true);
      setClockStatus(isOvertime ? 'FLOW OVERTIME' : 'LOCKED IN');
    }
    if (audioAutoPaused) {
      setAudioAutoPaused(false);
    }
  }, [pausedByAway, audioAutoPaused, isOvertime]);

  const handleToggleBrown = () => {
    const next = !brownOn;
    solarisAudio.playClack(next);
    setBrownOn(next);
    setAudioAutoPaused(false);
  };

  const handleToggleRain = () => {
    const next = !rainOn;
    solarisAudio.playClack(next);
    setRainOn(next);
    setAudioAutoPaused(false);
  };

  const handleBrownVolChange = (v: number) => {
    setBrownVol(v);
    if (!brownOn && v > 0) setBrownOn(true);
    setAudioAutoPaused(false);
  };

  const handleRainVolChange = (v: number) => {
    setRainVol(v);
    if (!rainOn && v > 0) setRainOn(true);
    setAudioAutoPaused(false);
  };

  const handleToggleMic = async () => {
    solarisAudio.playMechClick(560);
    if (micOn) {
      solarisAudio.stopMicShield();
      setMicOn(false);
      return;
    }
    const ok = await solarisAudio.startMicShield();
    if (ok) {
      setMicOn(true);
    } else {
      window.alert('Mic permission blocked.');
    }
  };

  const orbFrameCbRef = useRef<((x: number, y: number, gathered: number) => void) | null>(null);
  const orbRecalledCbRef = useRef<(() => void) | null>(null);

  const handleSpawnRipple = useCallback((opts: RippleOptions) => {
    worldRef.current?.spawnRipple(opts);
  }, []);

  const handleSetOrbState = useCallback((state: OrbControlState) => {
    worldRef.current?.setOrbState(state);
  }, []);

  const handleRegisterOrbFrame = useCallback(
    (cb: ((x: number, y: number, gathered: number) => void) | null) => {
      orbFrameCbRef.current = cb;
    },
    [],
  );

  const handleRegisterOrbRecalled = useCallback((cb: (() => void) | null) => {
    orbRecalledCbRef.current = cb;
  }, []);

  const handleOrbFrame = useCallback((x: number, y: number, gathered: number) => {
    orbFrameCbRef.current?.(x, y, gathered);
  }, []);

  const handleOrbRecalled = useCallback(() => {
    orbRecalledCbRef.current?.();
  }, []);

  const handleOrbGather = useCallback((count: number, whileDragging: boolean) => {
    if (whileDragging) {
      solarisAudio.playOrbGather(count);
    }
  }, []);

  const handleAddThought = (text: string) => {
    setVaultItems((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, createdAt: Date.now() },
      ...prev,
    ]);
  };

  const handleRemoveThought = (id: string) => {
    setVaultItems((prev) => prev.filter((item) => item.id !== id));
  };

  const canvasBrightness = 0.68 + warmth * 0.38;

  return (
    <div className={entered ? 'solaris-app entered' : 'solaris-app'}>
      <div className="grain" />
      <TwilightWorld
        ref={worldRef}
        brightness={canvasBrightness}
        onOrbFrame={handleOrbFrame}
        onOrbGather={handleOrbGather}
        onOrbRecalled={handleOrbRecalled}
      />

      <PortalIntro
        entered={entered}
        initialGoal={goal}
        onEnter={(chosenGoal) => {
          setGoal(chosenGoal);
          setEntered(true);
        }}
      />

      <div className={tabDimmed ? 'workspace tab-dimmed' : 'workspace'}>
        <HeaderBar goal={goal} drifts={drifts} onGoalChange={setGoal} />

        <main className="stage">
          <AudioDeck
            brownOn={brownOn}
            rainOn={rainOn}
            brownVol={brownVol}
            rainVol={rainVol}
            warmth={warmth}
            micOn={micOn}
            onToggleBrown={handleToggleBrown}
            onToggleRain={handleToggleRain}
            onBrownVolChange={handleBrownVolChange}
            onRainVolChange={handleRainVolChange}
            onWarmthChange={setWarmth}
            onToggleMic={() => void handleToggleMic()}
            onSpawnRipple={handleSpawnRipple}
            onSetOrbState={handleSetOrbState}
            onRegisterOrbFrame={handleRegisterOrbFrame}
            onRegisterOrbRecalled={handleRegisterOrbRecalled}
          />

          <AstrolabeClock
            durationMins={durationMins}
            remSec={remSec}
            overSec={overSec}
            isOvertime={isOvertime}
            running={running}
            status={clockStatus}
            quote={isOvertime ? OVERTIME_QUOTE : QUOTES[quoteIdx]}
            onSelectDuration={handleSelectDuration}
            onToggleRun={handleToggleRun}
            onReset={() => handleReset()}
          />

          <section className="capsule right" aria-label="Vault and Presence Witness">
            <ThoughtVault
              items={vaultItems}
              onAdd={handleAddThought}
              onRemove={handleRemoveThought}
            />
            <hr className="hair" />
            <PresenceWitness
              mode={camMode}
              onModeChange={setCamMode}
              onAway={handleAway}
              onReturn={handleReturn}
            />
          </section>
        </main>

        <SessionLedger ledger={ledger} />
      </div>
    </div>
  );
}

export default App;
