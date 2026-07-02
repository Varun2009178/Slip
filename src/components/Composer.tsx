import { useEffect, useRef, useState } from 'react';
import type { Email } from '../data/emails';
import { getApiKey, rewrite, setApiKey, type RewriteMode } from '../lib/ai';

interface Props {
  replyTo?: Email;
  onClose: () => void;
  onSend: () => void;
}

const MODE_LABELS: Record<RewriteMode, string> = {
  shorter: 'Shorter',
  formal: 'More formal',
  blunt: 'Blunter',
};

export default function Composer({ replyTo, onClose, onSend }: Props) {
  const [to, setTo] = useState(replyTo?.fromEmail ?? '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<RewriteMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  async function runRewrite(mode: RewriteMode) {
    if (!body.trim() || busy) return;
    if (!getApiKey()) {
      setNeedsKey(true);
      return;
    }
    const el = bodyRef.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? 0;
    const hasSelection = start !== end;
    const target = hasSelection ? body.slice(start, end) : body;

    setBusy(mode);
    setError(null);
    try {
      const result = await rewrite(target, mode);
      setBody(hasSelection ? body.slice(0, start) + result + body.slice(end) : result);
    } catch {
      setError("Couldn't rewrite — try again");
    } finally {
      setBusy(null);
      bodyRef.current?.focus();
    }
  }

  function trySend() {
    if (!to.trim()) {
      setError('Add a recipient');
      return;
    }
    if (!body.trim()) {
      setError('Write something first');
      return;
    }
    onSend();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      trySend();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <div className="composer" onKeyDown={handleKeyDown}>
      <header className="composer-nav">
        <button onClick={onClose}>
          ← Discard<kbd>Esc</kbd>
        </button>
        <button className="send" onClick={trySend}>
          Send<kbd>⌘↵</kbd>
        </button>
      </header>

      <input className="field" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
      <input
        className="field subject"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        ref={bodyRef}
        className="body-input"
        placeholder="Write…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <footer className="ai-bar">
        <span className="ai-label">Rewrite</span>
        {(Object.keys(MODE_LABELS) as RewriteMode[]).map((mode) => (
          <button key={mode} disabled={!!busy || !body.trim()} onClick={() => runRewrite(mode)}>
            {busy === mode ? '…' : MODE_LABELS[mode]}
          </button>
        ))}
        {error && <span className="ai-error">{error}</span>}
        {needsKey && (
          <span className="key-entry">
            <input
              type="password"
              placeholder="Paste Anthropic API key, press Enter"
              value={keyInput}
              autoFocus
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && keyInput.trim()) {
                  setApiKey(keyInput.trim());
                  setNeedsKey(false);
                  setKeyInput('');
                }
                if (e.key === 'Escape') setNeedsKey(false);
              }}
            />
          </span>
        )}
      </footer>
    </div>
  );
}
