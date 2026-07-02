import { useEffect, useMemo, useState } from 'react';
import type { Email } from './lib/types';
import {
  archive,
  connect,
  fetchInbox,
  fetchMessage,
  fetchThread,
  markRead,
  sendEmail,
  unarchive,
} from './lib/gmail';
import { addDoneId, loadDoneIds, removeDoneId } from './lib/done';
import { sortInbox } from './lib/mail';
import Connect from './components/Connect';
import Inbox from './components/Inbox';
import Reader from './components/Reader';
import Composer from './components/Composer';

type Section = 'inbox' | 'read';

type View =
  | { name: 'list' }
  | { name: 'reading'; id: string }
  | { name: 'composing'; replyTo?: Email };

type Theme = 'default' | 'paper';

interface Toast {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

const FADE_MS = 250;
const TOAST_MS = 5000;
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
  const [doneEmails, setDoneEmails] = useState<Email[] | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<Section>('inbox');
  const [view, setView] = useState<View>({ name: 'list' });
  const [thread, setThread] = useState<Email[] | null>(null);
  const [fadingIds, setFadingIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
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
  const activeList = section === 'read' ? (doneEmails ?? []) : inbox;

  useEffect(() => {
    if (!selectedId || !activeList.some((e) => e.id === selectedId)) {
      setSelectedId(activeList[0]?.id ?? null);
    }
  }, [activeList, selectedId]);

  function showToast(toast: Toast) {
    setToast(toast);
    window.setTimeout(() => setToast((t) => (t === toast ? null : t)), TOAST_MS);
  }

  async function refresh() {
    setLoading(true);
    try {
      setEmails(await fetchInbox());
    } catch {
      showToast({ text: "Couldn't load inbox" });
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

  async function openReadSection() {
    setSection('read');
    setDoneEmails(null);
    setLoading(true);
    try {
      const ids = loadDoneIds();
      const loaded = await Promise.all(ids.map((id) => fetchMessage(id).catch(() => null)));
      setDoneEmails(loaded.filter((m): m is Email => m !== null));
    } catch {
      setDoneEmails([]);
      showToast({ text: "Couldn't load read emails" });
    } finally {
      setLoading(false);
    }
  }

  function openEmail(id: string) {
    const email = activeList.find((m) => m.id === id);
    if (!email) return;
    if (section === 'inbox' && email.unread) {
      setEmails((list) => list?.map((m) => (m.id === id ? { ...m, unread: false } : m)) ?? null);
      markRead(id).catch(() => undefined);
    }
    setView({ name: 'reading', id });
    setThread(null);
    fetchThread(email.threadId)
      .then((msgs) => setThread(msgs.filter((m) => m.id !== id)))
      .catch(() => setThread([]));
  }

  function undoDone(email: Email) {
    setToast(null);
    removeDoneId(email.id);
    setDoneEmails((list) => list?.filter((m) => m.id !== email.id) ?? null);
    setEmails((list) => (list ? [...list, email] : [email]));
    unarchive(email.id).catch(() => {
      setEmails((list) => list?.filter((m) => m.id !== email.id) ?? null);
      addDoneId(email.id);
      showToast({ text: "Couldn't undo" });
    });
  }

  function markDone(id: string) {
    if (fadingIds.includes(id)) return;
    const email = emails?.find((m) => m.id === id);
    if (!email) return;
    setFadingIds((f) => [...f, id]);
    window.setTimeout(() => {
      setFadingIds((f) => f.filter((x) => x !== id));
      setEmails((list) => list?.filter((m) => m.id !== id) ?? null);
      setView((v) => (v.name === 'reading' && v.id === id ? { name: 'list' } : v));
      archive(id)
        .then(() => {
          addDoneId(id);
          setDoneEmails((list) => (list ? [email, ...list] : list));
          showToast({ text: 'Done', actionLabel: 'Undo', onAction: () => undoDone(email) });
        })
        .catch(() => {
          setEmails((list) => (list ? [...list, email] : [email]));
          showToast({ text: "Couldn't archive" });
        });
    }, FADE_MS);
  }

  function restore(id: string) {
    if (fadingIds.includes(id)) return;
    const email = doneEmails?.find((m) => m.id === id);
    if (!email) return;
    setFadingIds((f) => [...f, id]);
    window.setTimeout(() => {
      setFadingIds((f) => f.filter((x) => x !== id));
      setDoneEmails((list) => list?.filter((m) => m.id !== id) ?? null);
      setView((v) => (v.name === 'reading' && v.id === id ? { name: 'list' } : v));
      unarchive(id)
        .then(() => {
          removeDoneId(id);
          setEmails((list) => (list ? [...list, email] : [email]));
          showToast({ text: 'Back in inbox' });
        })
        .catch(() => {
          setDoneEmails((list) => (list ? [email, ...list] : [email]));
          showToast({ text: "Couldn't restore" });
        });
    }, FADE_MS);
  }

  const dismiss = section === 'read' ? restore : markDone;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view.name === 'composing' || emails === null) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (view.name === 'list') {
        const idx = activeList.findIndex((m) => m.id === selectedId);
        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          setSelectedId(activeList[Math.min(idx + 1, activeList.length - 1)]?.id ?? null);
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          setSelectedId(activeList[Math.max(idx - 1, 0)]?.id ?? null);
        } else if (e.key === 'Enter' && selectedId) {
          openEmail(selectedId);
        } else if (e.key.toLowerCase() === 'e' && selectedId) {
          dismiss(selectedId);
        } else if (e.key.toLowerCase() === 'c' && section === 'inbox') {
          e.preventDefault(); // keep the keystroke out of the autofocused composer
          setView({ name: 'composing' });
        } else if (e.key === 'Escape' && section === 'read') {
          setSection('inbox');
        }
      } else if (view.name === 'reading') {
        if (e.key.toLowerCase() === 'e') dismiss(view.id);
        else if (e.key === 'Escape') setView({ name: 'list' });
        else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          const email = activeList.find((m) => m.id === view.id);
          setView({ name: 'composing', replyTo: email });
        } else if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setView({ name: 'composing' });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, activeList, selectedId, fadingIds, emails, section]);

  if (emails === null) {
    return (
      <div className="app">
        <Connect error={connectError} onConnect={handleConnect} />
      </div>
    );
  }

  const readingEmail = view.name === 'reading' ? activeList.find((m) => m.id === view.id) : undefined;

  return (
    <div className="app">
      {view.name === 'list' && (
        <Inbox
          mode={section}
          emails={activeList}
          selectedId={selectedId}
          fadingIds={fadingIds}
          loading={loading}
          theme={theme}
          onOpen={openEmail}
          onSelect={setSelectedId}
          onCompose={() => setView({ name: 'composing' })}
          onRefresh={refresh}
          onToggleTheme={() => setTheme((t) => (t === 'paper' ? 'default' : 'paper'))}
          onSwitchView={() => (section === 'read' ? setSection('inbox') : void openReadSection())}
        />
      )}
      {readingEmail && (
        <Reader
          email={readingEmail}
          earlier={thread}
          fading={fadingIds.includes(readingEmail.id)}
          doneLabel={section === 'read' ? 'Restore' : 'Done'}
          onBack={() => setView({ name: 'list' })}
          onDone={() => dismiss(readingEmail.id)}
          onReply={() => setView({ name: 'composing', replyTo: readingEmail })}
        />
      )}
      {view.name === 'composing' && (
        <Composer
          replyTo={view.replyTo}
          onClose={() => setView({ name: 'list' })}
          onSend={async (mail) => {
            await sendEmail(mail);
            setView({ name: 'list' });
            showToast({ text: 'Sent' });
          }}
        />
      )}
      {toast && (
        <div className="toast">
          {toast.text}
          {toast.actionLabel && (
            <button className="toast-action" onClick={toast.onAction}>
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
