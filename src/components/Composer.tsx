import { useEffect, useRef, useState } from 'react';
import type { Email } from '../lib/types';
import type { OutgoingMail } from '../lib/gmail';

interface Props {
  replyTo?: Email;
  onClose: () => void;
  onSend: (mail: OutgoingMail) => Promise<void>;
}

export default function Composer({ replyTo, onClose, onSend }: Props) {
  const [to, setTo] = useState(replyTo?.fromEmail ?? '');
  const [subject, setSubject] = useState(
    replyTo ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : '',
  );
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  async function trySend() {
    if (sending) return;
    if (!to.trim()) {
      setError('Add a recipient');
      return;
    }
    if (!body.trim()) {
      setError('Write something first');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSend({
        to: to.trim(),
        subject,
        body,
        threadId: replyTo?.threadId,
        inReplyTo: replyTo?.rfcMessageId || undefined,
      });
    } catch {
      setError("Couldn't send — try again");
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void trySend();
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
        <button className="send" onClick={trySend} disabled={sending}>
          {sending ? 'Sending…' : 'Send'}
          <kbd>⌘↵</kbd>
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
      {error && (
        <footer className="ai-bar">
          <span className="ai-error">{error}</span>
        </footer>
      )}
    </div>
  );
}
