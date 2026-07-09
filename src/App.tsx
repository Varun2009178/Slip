import { useEffect, useMemo, useState } from 'react';
import type { Email } from './lib/types';
import {
  archive,
  connect,
  deleteDraft,
  fetchInbox,
  fetchMessage,
  fetchProfile,
  fetchThread,
  listDrafts,
  markRead,
  saveDraft,
  sendEmail,
  unarchive,
  type Draft,
  type OutgoingMail,
  type Profile,
} from './lib/gmail';
import { addDoneId, loadDoneIds, removeDoneId } from './lib/done';
import { sortInbox } from './lib/mail';
import Connect, { SlipAnimation } from './components/Connect';
import Inbox, { type Section } from './components/Inbox';
import Reader from './components/Reader';
import Composer from './components/Composer';
import Sidebar from './components/Sidebar';

type View =
  | { name: 'list' }
  | { name: 'reading'; id: string }
  | { name: 'composing'; replyTo?: Email; draft?: Draft };

type Theme = 'default' | 'paper';

interface Toast {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

const FADE_MS = 250;
const TOAST_MS = 5000;
const ENTER_MS = 1100;
const THEME_KEY = 'tiny-mail-theme';

function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'paper' ? 'paper' : 'default';
  } catch {
    return 'default';
  }
}

function draftRow(d: Draft): Email {
  return {
    id: d.draftId,
    threadId: d.threadId ?? '',
    rfcMessageId: '',
    from: d.to || '(no recipient)',
    fromEmail: d.to,
    subject: d.subject || '(no subject)',
    snippet: d.body.replace(/\s+/g, ' ').slice(0, 90),
    body: d.body,
    bodyHtml: null,
    date: d.date,
    unread: false,
    starred: false,
  };
}

export default function App() {
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [doneEmails, setDoneEmails] = useState<Email[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<Section>('inbox');
  const [view, setView] = useState<View>({ name: 'list' });
  const [thread, setThread] = useState<Email[] | null>(null);
  const [fadingIds, setFadingIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // theme just won't persist
    }
  }, [theme]);

  const inbox = useMemo(() => sortInbox(emails ?? []), [emails]);
  const activeList = useMemo(
    () =>
      section === 'read'
        ? (doneEmails ?? [])
        : section === 'drafts'
          ? (drafts ?? []).map(draftRow)
          : inbox,
    [section, doneEmails, drafts, inbox],
  );

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
      fetchProfile().then(setProfile).catch(() => undefined);
      const inbox = await fetchInbox();
      setEntering(true);
      setEmails(inbox);
      window.setTimeout(() => setEntering(false), ENTER_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'auth-failed';
      setConnectError(
        msg === 'auth-failed' || msg === 'missing-client-id'
          ? "Couldn't connect — check the Client ID and that you're a test user"
          : `Couldn't connect: ${msg}`,
      );
    }
  }

  function navigate(target: Section) {
    setView({ name: 'list' });
    setSection(target);
    if (target === 'read') {
      setDoneEmails(null);
      setLoading(true);
      const ids = loadDoneIds();
      Promise.all(ids.map((id) => fetchMessage(id).catch(() => null)))
        .then((loaded) => setDoneEmails(loaded.filter((m): m is Email => m !== null)))
        .catch(() => setDoneEmails([]))
        .finally(() => setLoading(false));
    } else if (target === 'drafts') {
      setDrafts(null);
      setLoading(true);
      listDrafts()
        .then(setDrafts)
        .catch(() => {
          setDrafts([]);
          showToast({ text: "Couldn't load drafts" });
        })
        .finally(() => setLoading(false));
    }
  }

  function openEmail(id: string) {
    if (section === 'drafts') {
      const draft = drafts?.find((d) => d.draftId === id);
      if (draft) setView({ name: 'composing', draft });
      return;
    }
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

  function removeDraft(draftId: string) {
    if (fadingIds.includes(draftId)) return;
    const draft = drafts?.find((d) => d.draftId === draftId);
    if (!draft) return;
    setFadingIds((f) => [...f, draftId]);
    window.setTimeout(() => {
      setFadingIds((f) => f.filter((x) => x !== draftId));
      setDrafts((list) => list?.filter((d) => d.draftId !== draftId) ?? null);
      deleteDraft(draftId)
        .then(() => showToast({ text: 'Draft deleted' }))
        .catch(() => {
          setDrafts((list) => (list ? [draft, ...list] : [draft]));
          showToast({ text: "Couldn't delete draft" });
        });
    }, FADE_MS);
  }

  const dismiss = section === 'read' ? restore : section === 'drafts' ? removeDraft : markDone;

  async function handleSend(mail: OutgoingMail, draftId?: string) {
    await sendEmail(mail);
    if (draftId) {
      deleteDraft(draftId).catch(() => undefined);
      setDrafts((list) => list?.filter((d) => d.draftId !== draftId) ?? null);
    }
    setView({ name: 'list' });
    showToast({ text: 'Sent' });
  }

  async function handleSaveDraft(mail: OutgoingMail, draftId?: string) {
    await saveDraft(mail, draftId);
    setDrafts(null); // stale — refetched next time the section opens
    if (section === 'drafts') navigate('drafts');
    setView({ name: 'list' });
    showToast({ text: 'Saved to drafts' });
  }

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
        } else if (e.key.toLowerCase() === 'c' && section !== 'read') {
          e.preventDefault(); // keep the keystroke out of the autofocused composer
          setView({ name: 'composing' });
        } else if (e.key === 'Escape' && section !== 'inbox') {
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
  }, [view, activeList, selectedId, fadingIds, emails, section, drafts]);

  if (emails === null) {
    return (
      <div className="app">
        <Connect error={connectError} onConnect={handleConnect} />
      </div>
    );
  }

  const readingEmail = view.name === 'reading' ? activeList.find((m) => m.id === view.id) : undefined;

  return (
    <div className={entering ? 'shell entering' : 'shell'}>
      {entering && (
        <div className="enter-overlay" aria-hidden="true">
          <SlipAnimation />
        </div>
      )}
      <Sidebar
        section={section}
        inboxCount={inbox.length}
        draftsCount={drafts?.length ?? null}
        profile={profile}
        theme={theme}
        onNavigate={navigate}
        onCompose={() => setView({ name: 'composing' })}
        onToggleTheme={() => setTheme((t) => (t === 'paper' ? 'default' : 'paper'))}
      />
      <main className="pane">
        {(view.name === 'list' || view.name === 'composing') && (
          <Inbox
            mode={section}
            emails={activeList}
            selectedId={selectedId}
            fadingIds={fadingIds}
            loading={loading}
            onOpen={openEmail}
            onSelect={setSelectedId}
            onRefresh={refresh}
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
      </main>
      {view.name === 'composing' && (
        <Composer
          replyTo={view.replyTo}
          draft={view.draft}
          onClose={() => setView({ name: 'list' })}
          onSend={handleSend}
          onSaveDraft={handleSaveDraft}
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
