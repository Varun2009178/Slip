import { useEffect, useRef, useState } from 'react';
import type { Email } from '../lib/types';

interface Props {
  queue: Email[];
  onReply: (email: Email, body: string) => Promise<void>;
  onExit: () => void;
}

// Force reply: one email at a time — sender, subject, reply box, nothing
// else. ⌘↵ sends and auto-advances. TikTok, but for clearing your inbox.
export default function ForceReply({ queue, onReply, onExit }: Props) {
  const [emails] = useState(queue); // snapshot at entry; the inbox mutates behind us
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(0);

  const email = emails[index];
  const done = emails.length > 0 && index >= emails.length;

  useEffect(() => {
    if (done) {
      finishedRef.current ||= Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
      return;
    }
    const t = window.setInterval(
      () => setElapsed(Math.round((Date.now() - startRef.current) / 1000)),
      1000,
    );
    return () => window.clearInterval(t);
  }, [done]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onExit();
      } else if (done && e.key === 'Enter') {
        e.stopPropagation(); // or the list handler opens an email with the same keystroke
        onExit();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [done, onExit]);

  function advance() {
    setText('');
    setError(null);
    setIndex((i) => i + 1);
  }

  async function send() {
    const body = text.trim();
    if (!email || !body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onReply(email, body);
      setSent((s) => s + 1);
      advance();
    } catch {
      setError("couldn't send — try again");
    } finally {
      setSending(false);
    }
  }

  if (emails.length === 0) {
    return (
      <div className="force">
        <div className="force-card force-end">
          <h1>inbox zero.</h1>
          <p className="force-stat">nothing to force. go build something.</p>
          <button className="send" onClick={onExit}>
            back
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="force">
        <div className="force-card force-end">
          <h1>
            {sent} {sent === 1 ? 'reply' : 'replies'} in {finishedRef.current || elapsed}s.
          </h1>
          <p className="force-stat">
            {sent === emails.length ? 'every single one. machine.' : `${emails.length - sent} skipped — they can wait.`}
          </p>
          <button className="send" onClick={onExit}>
            back to inbox <kbd>↵</kbd>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="force">
      <div className="force-top">
        <span className="force-progress">
          {index + 1} / {emails.length}
        </span>
        <span className="force-timer">{elapsed}s</span>
        <button className="force-exit" onClick={onExit}>
          esc
        </button>
      </div>
      <div className="force-card">
        <p className="force-from">{email.from}</p>
        <h1 className="force-subject">{email.subject}</h1>
        <textarea
          key={email.id} // fresh, autofocused box per email
          className="force-reply"
          placeholder="type your reply…"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
        />
        {error && <p className="ai-error">{error}</p>}
        <div className="force-actions">
          <button onClick={advance} disabled={sending}>
            skip →
          </button>
          <button className="send" onClick={send} disabled={sending || !text.trim()}>
            {sending ? 'sending…' : 'send'} <kbd>⌘↵</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
