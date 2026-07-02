import { useEffect, useMemo, useState } from 'react';
import { emails as allEmails, type Email } from './data/emails';
import { loadState, saveState, type MailState } from './lib/store';
import { sortInbox } from './lib/mail';
import Inbox from './components/Inbox';
import Reader from './components/Reader';
import Composer from './components/Composer';

type View =
  | { name: 'inbox' }
  | { name: 'reading'; id: string }
  | { name: 'composing'; replyTo?: Email };

const FADE_MS = 250;

export default function App() {
  const [state, setState] = useState<MailState>(loadState);
  const [view, setView] = useState<View>({ name: 'inbox' });
  const [fadingIds, setFadingIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const inbox = useMemo(
    () => sortInbox(allEmails.filter((e) => !state.doneIds.includes(e.id))),
    [state.doneIds],
  );

  useEffect(() => saveState(state), [state]);

  // Keep a valid selection as the inbox changes
  useEffect(() => {
    if (!selectedId || !inbox.some((e) => e.id === selectedId)) {
      setSelectedId(inbox[0]?.id ?? null);
    }
  }, [inbox, selectedId]);

  function openEmail(id: string) {
    setState((s) => (s.readIds.includes(id) ? s : { ...s, readIds: [...s.readIds, id] }));
    setView({ name: 'reading', id });
  }

  function markDone(id: string) {
    if (fadingIds.includes(id)) return;
    setFadingIds((f) => [...f, id]);
    window.setTimeout(() => {
      setFadingIds((f) => f.filter((x) => x !== id));
      setState((s) => ({ ...s, doneIds: [...s.doneIds, id] }));
      setView((v) => (v.name === 'reading' && v.id === id ? { name: 'inbox' } : v));
    }, FADE_MS);
  }

  function sendDraft() {
    setView({ name: 'inbox' });
    setToast('Sent');
    window.setTimeout(() => setToast(null), 1600);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view.name === 'composing') return; // Composer handles its own keys
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (view.name === 'inbox') {
        const idx = inbox.findIndex((m) => m.id === selectedId);
        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          setSelectedId(inbox[Math.min(idx + 1, inbox.length - 1)]?.id ?? null);
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          setSelectedId(inbox[Math.max(idx - 1, 0)]?.id ?? null);
        } else if (e.key === 'Enter' && selectedId) {
          openEmail(selectedId);
        } else if (e.key.toLowerCase() === 'e' && selectedId) {
          markDone(selectedId);
        } else if (e.key.toLowerCase() === 'c') {
          setView({ name: 'composing' });
        }
      } else if (view.name === 'reading') {
        if (e.key.toLowerCase() === 'e') markDone(view.id);
        else if (e.key === 'Escape') setView({ name: 'inbox' });
        else if (e.key.toLowerCase() === 'r') {
          const email = allEmails.find((m) => m.id === view.id);
          setView({ name: 'composing', replyTo: email });
        } else if (e.key.toLowerCase() === 'c') {
          setView({ name: 'composing' });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, inbox, selectedId, fadingIds]);

  const readingEmail = view.name === 'reading' ? allEmails.find((m) => m.id === view.id) : undefined;

  return (
    <div className="app">
      {view.name === 'inbox' && (
        <Inbox
          emails={inbox}
          readIds={state.readIds}
          selectedId={selectedId}
          fadingIds={fadingIds}
          onOpen={openEmail}
          onSelect={setSelectedId}
          onCompose={() => setView({ name: 'composing' })}
        />
      )}
      {readingEmail && (
        <Reader
          email={readingEmail}
          fading={fadingIds.includes(readingEmail.id)}
          onBack={() => setView({ name: 'inbox' })}
          onDone={() => markDone(readingEmail.id)}
          onReply={() => setView({ name: 'composing', replyTo: readingEmail })}
        />
      )}
      {view.name === 'composing' && (
        <Composer replyTo={view.replyTo} onClose={() => setView({ name: 'inbox' })} onSend={sendDraft} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
