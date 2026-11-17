import { useEffect, useRef, useState } from 'react';
import { solarisAudio } from '../audio/solarisAudio';
import type { ThoughtItem } from '../types/solaris';

interface ThoughtVaultProps {
  items: ThoughtItem[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}

export function ThoughtVault({ items, onAdd, onRemove }: ThoughtVaultProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === '/' && target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    solarisAudio.playMechClick(760);
    onAdd(trimmed);
    setDraft('');
  };

  return (
    <>
      <div className="cap-label">Vault</div>
      <form className="vault-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Park a stray thought (/)…"
          autoComplete="off"
        />
      </form>
      <div className="vault-list">
        {items.map((item) => (
          <div key={item.id} className="vault-item">
            <span>{item.text}</span>
            <button
              type="button"
              className="vault-del"
              aria-label="Delete thought"
              onClick={() => {
                solarisAudio.playMechClick(440);
                onRemove(item.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
