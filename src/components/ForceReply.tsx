import { useEffect, useRef, useState } from 'react';
import type { Email } from '../lib/types';
import { snoozePresets } from '../lib/when';
import EmailBody from './EmailBody';
import WhenPicker from './WhenPicker';

interface Props {
  queue: Email[];
  onReply: (email: Email, body: string) => Promise<void>;
  onSnooze: (email: Email, when: Date) => void;
  onArchive: (email: Email) => void;
  onExit: () => void;
}

// Force reply: one email at a time — the message, a reply box, and four
// moves: send, snooze, mark done, skip. TikTok, but for clearing your inbox.
export default function ForceReply({ queue, onReply, onSnooze, onArchive, onExit }: Props) {
  const [emails] = useState(queue); // snapshot at entry; the inbox mutates behind us
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState({ sent: 0, snoozed: 0, archived: 0 });
  const [picking, setPicking] = useState(false);
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
      if (picking) return; // the when-picker owns the keyboard
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
  }, [done, picking, onExit]);

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
      setStats((s) => ({ ...s, sent: s.sent + 1 }));
      advance();
    } catch {
      setError("couldn't send. try again");
    } finally {
      setSending(false);
    }
  }

  function snooze(when: Date) {
    setPicking(false);
    if (!email) return;
    onSnooze(email, when);
    setStats((s) => ({ ...s, snoozed: s.snoozed + 1 }));
    advance();
  }

  function archive() {
    if (!email) return;
    onArchive(email);
    setStats((s) => ({ ...s, archived: s.archived + 1 }));
    advance();
  }

  function onReplyKeys(e: React.KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    } else if (k === 'e') {
      e.preventDefault();
      archive();
    } else if (k === 's') {
      e.preventDefault();
      setPicking(true);
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
    const parts = [
      `${stats.sent} ${stats.sent === 1 ? 'reply' : 'replies'}`,
      stats.snoozed > 0 && `${stats.snoozed} snoozed`,
      stats.archived > 0 && `${stats.archived} done`,
    ].filter(Boolean);
    const skipped = emails.length - stats.sent - stats.snoozed - stats.archived;
    return (
      <div className="force">
        <div className="force-card force-end">
          <h1>
            {parts.join(' · ')} in {finishedRef.current || elapsed}s.
          </h1>
          <p className="force-stat">
            {skipped === 0 ? 'every single one. machine.' : `${skipped} skipped. they can wait.`}
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
      <div className="force-bar" aria-hidden="true">
        <div className="force-bar-fill" style={{ width: `${(index / emails.length) * 100}%` }} />
      </div>
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
        <div className="force-body">
          <EmailBody email={email} />
        </div>
        <textarea
          key={email.id} // fresh, autofocused box per email
          className="force-reply"
          placeholder="type your reply…"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onReplyKeys}
        />
        {error && <p className="ai-error">{error}</p>}
        <div className="force-actions">
          <div className="force-actions-left">
            <button onClick={advance} disabled={sending}>
              skip →
            </button>
            <button onClick={() => setPicking(true)} disabled={sending}>
              snooze <kbd>⌘S</kbd>
            </button>
            <button onClick={archive} disabled={sending}>
              mark done <kbd>⌘E</kbd>
            </button>
          </div>
          <button className="send" onClick={send} disabled={sending || !text.trim()}>
            {sending ? 'sending…' : 'send'} <kbd>⌘↵</kbd>
          </button>
        </div>
        <p className="force-hint">
          reply, snooze, or mark it done. the bar up top is your progress. inbox zero is minutes
          away.
        </p>
      </div>
      {picking && (
        <WhenPicker
          title="snooze until…"
          options={snoozePresets(new Date())}
          onPick={snooze}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
