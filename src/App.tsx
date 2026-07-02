import { useEffect, useMemo, useState } from 'react';
import type { Email } from './lib/types';
import { archive, connect, fetchInbox, fetchThread, markRead, sendEmail } from './lib/gmail';
import { sortInbox } from './lib/mail';
import Connect from './components/Connect';
import Inbox from './components/Inbox';
import Reader from './components/Reader';
import Composer from './components/Composer';

type View =
  | { name: 'inbox' }
  | { name: 'reading'; id: string }
  | { name: 'composing'; replyTo?: Email };

type Theme = 'default' | 'paper';

const FADE_MS = 250;
const THEME_KEY = 'tiny-mail-theme';

function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'paper' ? 'paper' : 'default';
  } catch {
    return 'default';
  }
}

export default function App() {
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>({ name: 'inbox' });
  const [thread, setThread] = useState<Email[] | null>(null);
  const [fadingIds, setFadingIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // theme just won't persist
    }
  }, [theme]);

  const inbox = useMemo(() => sortInbox(emails ?? []), [emails]);

  useEffect(() => {
    if (!selectedId || !inbox.some((e) => e.id === selectedId)) {
      setSelectedId(inbox[0]?.id ?? null);
    }
  }, [inbox, selectedId]);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2000);
  }

  async function refresh() {
    setLoading(true);
    try {
      setEmails(await fetchInbox());
    } catch {
      showToast("Couldn't load inbox");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnectError(null);
    try {
      await connect();
      setEmails(await fetchInbox());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'auth-failed';
      setConnectError(
        msg === 'auth-failed' || msg === 'missing-client-id'
          ? "Couldn't connect — check the Client ID and that you're a test user"
          : `Couldn't connect: ${msg}`,
      );
    }
  }

  function openEmail(id: string) {
    const email = emails?.find((m) => m.id === id);
    if (!email) return;
    setEmails((list) => list?.map((m) => (m.id === id ? { ...m, unread: false } : m)) ?? null);
    setView({ name: 'reading', id });
    setThread(null);
    if (email.unread) markRead(id).catch(() => undefined);
    fetchThread(email.threadId)
      .then((msgs) => setThread(msgs.filter((m) => m.id !== id)))
      .catch(() => setThread([]));
  }

  function markDone(id: string) {
    if (fadingIds.includes(id)) return;
    setFadingIds((f) => [...f, id]);
    window.setTimeout(() => {
      setFadingIds((f) => f.filter((x) => x !== id));
      const removed = emails?.find((m) => m.id === id);
      setEmails((list) => list?.filter((m) => m.id !== id) ?? null);
      setView((v) => (v.name === 'reading' && v.id === id ? { name: 'inbox' } : v));
      archive(id).catch(() => {
        if (removed) setEmails((list) => (list ? [...list, removed] : [removed]));
        showToast("Couldn't archive");
      });
    }, FADE_MS);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view.name === 'composing' || emails === null) return;
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
          const email = emails.find((m) => m.id === view.id);
          setView({ name: 'composing', replyTo: email });
        } else if (e.key.toLowerCase() === 'c') {
          setView({ name: 'composing' });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, inbox, selectedId, fadingIds, emails]);

  if (emails === null) {
    return (
      <div className="app">
        <Connect error={connectError} onConnect={handleConnect} />
      </div>
    );
  }

  const readingEmail = view.name === 'reading' ? emails.find((m) => m.id === view.id) : undefined;

  return (
    <div className="app">
      {view.name === 'inbox' && (
        <Inbox
          emails={inbox}
          selectedId={selectedId}
          fadingIds={fadingIds}
          loading={loading}
          theme={theme}
          onOpen={openEmail}
          onSelect={setSelectedId}
          onCompose={() => setView({ name: 'composing' })}
          onRefresh={refresh}
          onToggleTheme={() => setTheme((t) => (t === 'paper' ? 'default' : 'paper'))}
        />
      )}
      {readingEmail && (
        <Reader
          email={readingEmail}
          earlier={thread}
          fading={fadingIds.includes(readingEmail.id)}
          onBack={() => setView({ name: 'inbox' })}
          onDone={() => markDone(readingEmail.id)}
          onReply={() => setView({ name: 'composing', replyTo: readingEmail })}
        />
      )}
      {view.name === 'composing' && (
        <Composer
          replyTo={view.replyTo}
          onClose={() => setView({ name: 'inbox' })}
          onSend={async (mail) => {
            await sendEmail(mail);
            setView({ name: 'inbox' });
            showToast('Sent');
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
