interface HeaderBarProps {
  goal: string;
  drifts: number;
  onGoalChange: (goal: string) => void;
}

export function HeaderBar({ goal, drifts, onGoalChange }: HeaderBarProps) {
  return (
    <header className="header">
      <div className="brand">
        <div className="crown-gem" />
        SOLARIS
      </div>
      <div className="goal">
        <input
          type="text"
          aria-label="Session objective"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
        />
      </div>
      <div className="drifts">
        Drifts<b>{drifts}</b>
      </div>
    </header>
  );
}
