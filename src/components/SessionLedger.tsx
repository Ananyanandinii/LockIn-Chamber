import type { LedgerStats } from '../types/solaris';

interface SessionLedgerProps {
  ledger: LedgerStats;
}

export function SessionLedger({ ledger }: SessionLedgerProps) {
  return (
    <footer className="ledger">
      <div>
        Focused<span>{ledger.mins}m</span>
      </div>
      <div>
        Flow<span>+{ledger.flow}m</span>
      </div>
      <div>
        Blocks<span>{ledger.blocks}</span>
      </div>
    </footer>
  );
}
