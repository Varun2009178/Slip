import { useEffect, useMemo, useState } from 'react';
import type { Email } from './lib/types';
import {
  archive,
  connect,
  deleteDraft,
  fetchInbox,
  fetchMessage,
  fetchProfile,
  fetchSelfEmail,
  fetchSent,
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
import { newCampaign, type Campaign } from './lib/outreach';
import { loadCampaigns, saveCampaigns, upsertCampaign } from './lib/campaignStore';
import { useCampaignSender } from './hooks/useCampaignSender';
import Campaigns from './components/Campaigns';
import CampaignWizard, { type WizardStep } from './components/CampaignWizard';
import { addDoneId, loadDoneIds, removeDoneId } from './lib/done';
import { addSnooze, dueSnoozeIds, pendingSnoozeIds, removeSnooze } from './lib/snooze';
import { formatWhen, snoozePresets } from './lib/when';
import { sortInbox } from './lib/mail';
import Connect, { DENIED_ERROR, SlipAnimation } from './components/Connect';
import FrontScene, { MeadowSprig } from './components/FrontScene';
import Legal from './components/Legal';
import Roadmap from './components/Roadmap';
import Showcase from './components/Showcase';
import Waitlist from './components/Waitlist';
import WhenPicker from './components/WhenPicker';
import ForceReply from './components/ForceReply';
import CommandPalette from './components/CommandPalette';
import Home from './components/Home';
import type { Prefill } from './components/Composer';
import type { Command } from './lib/commands';
import { SlipMark } from './components/icons';
import Inbox, { type Section } from './components/Inbox';
import Reader from './components/Reader';
import Composer from './components/Composer';
import Sidebar from './components/Sidebar';

type View =
  | { name: 'home' }
  | { name: 'list' }
  | { name: 'reading'; id: string }
  | { name: 'force' }
  | { name: 'campaigns' }
  | { name: 'campaign'; id: string; step: WizardStep }
  | { name: 'thread'; email: Email; campaignId: string } // a reply opened from the tracking view
  | { name: 'composing'; replyTo?: Email; draft?: Draft; prefill?: Prefill };

type Theme = 'default' | 'paper';
type StartScreen = 'keys' | 'inbox';

const FEATURE_EMAIL = 'varun@teyra.app';

interface Toast {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

const FADE_MS = 250;
const TOAST_MS = 5000;
const ENTER_MS = 1100;
const THEME_KEY = 'tiny-mail-theme';
const START_KEY = 'tiny-mail-start';
const ACCESS_KEY = 'slip-has-access';

// Everyone hits the waitlist until they claim access once on this browser.
function hasAccess(): boolean {
  try {
    return !!localStorage.getItem(ACCESS_KEY);
  } catch {
    return false;
  }
}

function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'paper' ? 'paper' : 'default';
  } catch {
    return 'default';
  }
}

function loadStart(): StartScreen {
  try {
    return localStorage.getItem(START_KEY) === 'inbox' ? 'inbox' : 'keys';
  } catch {
    return 'keys';
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
  const [sentEmails, setSentEmails] = useState<Email[] | null>(null);
  const [snoozedEmails, setSnoozedEmails] = useState<Email[] | null>(null);
  const [snoozeTarget, setSnoozeTarget] = useState<Email | null>(null);
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
  const [start, setStart] = useState<StartScreen>(loadStart);
  const [gate, setGate] = useState<'waitlist' | 'connect'>(() => (hasAccess() ? 'connect' : 'waitlist'));
  const [entering, setEntering] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>(loadCampaigns);
  const [selfEmail, setSelfEmail] = useState<string | null>(null);

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
        : section === 'sent'
          ? (sentEmails ?? [])
          : section === 'snoozed'
            ? (snoozedEmails ?? [])
            : section === 'drafts'
              ? (drafts ?? []).map(draftRow)
              : inbox,
    [section, doneEmails, sentEmails, snoozedEmails, drafts, inbox],
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

  // Snoozes past their wake time go back into the inbox before we fetch it.
  async function wakeDueSnoozes() {
    await Promise.all(
      dueSnoozeIds().map((id) =>
        unarchive(id)
          .then(() => removeSnooze(id))
          .catch(() => undefined),
      ),
    );
  }

  async function refresh() {
    setLoading(true);
    try {
      await wakeDueSnoozes();
      setEmails(await fetchInbox());
    } catch {
      showToast({ text: "couldn't load inbox" });
    } finally {
      setLoading(false);
    }
  }

  function updateCampaign(c: Campaign) {
    setCampaigns((prev) => {
      const next = upsertCampaign(prev, c);
      if (!saveCampaigns(next)) {
        setToast({ text: "storage is blocked — this batch won't survive a refresh" });
      }
      return next;
    });
  }

  // Functional variant for async producers (reply poll): folds over React's
  // authoritative previous state, so a write computed from a render-lagged
  // snapshot can never revert a concurrent send-loop update.
  function updateCampaignBy(id: string, fn: (prev: Campaign) => Campaign) {
    setCampaigns((prev) => {
      const target = prev.find((c) => c.id === id);
      if (!target) return prev;
      const next = upsertCampaign(prev, fn(target));
      if (!saveCampaigns(next)) {
        setToast({ text: "storage is blocked — this batch won't survive a refresh" });
      }
      return next;
    });
  }

  const sendingActive = campaigns.some((c) => c.state === 'sending');

  useCampaignSender({
    campaigns,
    update: updateCampaign,
    onAuthExpired: (paused) =>
      setToast({
        text: 'gmail session expired — the batch is paused',
        actionLabel: 'reconnect & resume',
        onAction: () => {
          setToast(null);
          connect()
            // Functional resume — edits made while the toast sat open must survive.
            .then(() => updateCampaignBy(paused.id, (prev) => ({ ...prev, state: 'sending' })))
            .catch(() => setToast({ text: "couldn't reconnect — try again from the batch page" }));
        },
      }),
  });

  // "reply without switching tabs": a replied row opens the actual reply in
  // Slip's reader, one click from the composer.
  async function openOutreachReply(campaignId: string, threadId: string) {
    try {
      const msgs = await fetchThread(threadId);
      const reply =
        [...msgs]
          .reverse()
          .find((m) => selfEmail && m.fromEmail.toLowerCase() !== selfEmail.toLowerCase()) ??
        msgs[msgs.length - 1];
      setThread(msgs.filter((m) => m.id !== reply.id));
      setView({ name: 'thread', email: reply, campaignId });
    } catch {
      setToast({ text: "couldn't open the reply — try your inbox" });
    }
  }

  // Leaving the page kills the send loop; warn while a batch is going out.
  useEffect(() => {
    if (!sendingActive) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sendingActive]);

  async function handleConnect() {
    setConnectError(null);
    try {
      await connect();
      fetchProfile().then(setProfile).catch(() => undefined);
      await wakeDueSnoozes().catch(() => undefined);
      const inbox = await fetchInbox();
      setEntering(true);
      setEmails(inbox);
      setView(start === 'inbox' ? { name: 'list' } : { name: 'campaigns' });
      fetchSelfEmail().then(setSelfEmail).catch(() => undefined);
      window.setTimeout(() => setEntering(false), ENTER_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'auth-failed';
      // Non-test-users end at Google's "access blocked" page (access_denied),
      // close the popup (popup_closed), or slip through OAuth only to have the
      // Gmail API itself refuse them (gmail-429/403) — all read as "not on the list".
      setConnectError(
        /access_denied|popup_closed|gmail-429|gmail-403/i.test(msg)
          ? DENIED_ERROR
          : msg === 'auth-failed'
            ? "Couldn't connect — try again in a moment"
            : msg === 'missing-client-id'
              ? "Couldn't connect — the app is missing its Google client ID (set VITE_GOOGLE_CLIENT_ID)"
              : `Couldn't connect: ${msg}`,
      );
    }
  }

  function toggleStart() {
    setStart((s) => {
      const next = s === 'keys' ? 'inbox' : 'keys';
      try {
        localStorage.setItem(START_KEY, next);
      } catch {
        // preference just won't persist
      }
      return next;
    });
  }

  function requestFeature() {
    setView({ name: 'composing', prefill: { to: FEATURE_EMAIL, subject: 'Slip feature request' } });
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
    } else if (target === 'snoozed') {
      setSnoozedEmails(null);
      setLoading(true);
      const ids = pendingSnoozeIds();
      Promise.all(ids.map((id) => fetchMessage(id).catch(() => null)))
        .then((loaded) => setSnoozedEmails(loaded.filter((m): m is Email => m !== null)))
        .catch(() => setSnoozedEmails([]))
        .finally(() => setLoading(false));
    } else if (target === 'sent') {
      setSentEmails(null);
      setLoading(true);
      fetchSent()
        .then(setSentEmails)
        .catch(() => {
          setSentEmails([]);
          showToast({ text: "couldn't load sent mail" });
        })
        .finally(() => setLoading(false));
    } else if (target === 'drafts') {
      setDrafts(null);
      setLoading(true);
      listDrafts()
        .then(setDrafts)
        .catch(() => {
          setDrafts([]);
          showToast({ text: "couldn't load drafts" });
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
      showToast({ text: "couldn't undo" });
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
          showToast({ text: 'done', actionLabel: 'undo', onAction: () => undoDone(email) });
        })
        .catch(() => {
          setEmails((list) => (list ? [...list, email] : [email]));
          showToast({ text: "couldn't archive" });
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
          showToast({ text: 'back in inbox' });
        })
        .catch(() => {
          setDoneEmails((list) => (list ? [email, ...list] : [email]));
          showToast({ text: "couldn't restore" });
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
        .then(() => showToast({ text: 'draft deleted' }))
        .catch(() => {
          setDrafts((list) => (list ? [draft, ...list] : [draft]));
          showToast({ text: "couldn't delete draft" });
        });
    }, FADE_MS);
  }

  function snoozeEmail(email: Email, when: Date) {
    setSnoozeTarget(null);
    if (fadingIds.includes(email.id)) return;
    setFadingIds((f) => [...f, email.id]);
    window.setTimeout(() => {
      setFadingIds((f) => f.filter((x) => x !== email.id));
      setEmails((list) => list?.filter((m) => m.id !== email.id) ?? null);
      setView((v) => (v.name === 'reading' && v.id === email.id ? { name: 'list' } : v));
      archive(email.id)
        .then(() => {
          addSnooze(email.id, when.getTime());
          showToast({ text: `snoozed until ${formatWhen(when)}` });
        })
        .catch(() => {
          setEmails((list) => (list ? [...list, email] : [email]));
          showToast({ text: "couldn't snooze" });
        });
    }, FADE_MS);
  }

  function unsnooze(id: string) {
    if (fadingIds.includes(id)) return;
    const email = snoozedEmails?.find((m) => m.id === id);
    if (!email) return;
    setFadingIds((f) => [...f, id]);
    window.setTimeout(() => {
      setFadingIds((f) => f.filter((x) => x !== id));
      setSnoozedEmails((list) => list?.filter((m) => m.id !== id) ?? null);
      setView((v) => (v.name === 'reading' && v.id === id ? { name: 'list' } : v));
      unarchive(id)
        .then(() => {
          removeSnooze(id);
          setEmails((list) => (list ? [...list, email] : [email]));
          showToast({ text: 'back in inbox' });
        })
        .catch(() => {
          setSnoozedEmails((list) => (list ? [email, ...list] : [email]));
          showToast({ text: "couldn't unsnooze" });
        });
    }, FADE_MS);
  }

  // Force reply: send, archive, drop from the inbox — the mode auto-advances.
  async function forceReplySend(email: Email, body: string) {
    await sendEmail({
      to: email.fromEmail,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body,
      threadId: email.threadId,
      inReplyTo: email.rfcMessageId || undefined,
    });
    setEmails((list) => list?.filter((m) => m.id !== email.id) ?? null);
    archive(email.id)
      .then(() => addDoneId(email.id))
      .catch(() => undefined);
  }

  function forceSnooze(email: Email, when: Date) {
    setEmails((list) => list?.filter((m) => m.id !== email.id) ?? null);
    archive(email.id)
      .then(() => addSnooze(email.id, when.getTime()))
      .catch(() => undefined);
  }

  function forceArchive(email: Email) {
    setEmails((list) => list?.filter((m) => m.id !== email.id) ?? null);
    archive(email.id)
      .then(() => addDoneId(email.id))
      .catch(() => undefined);
  }

  // Sent mail has no dismiss action — it lives in Gmail's Sent label forever.
  const dismiss =
    section === 'read'
      ? restore
      : section === 'drafts'
        ? removeDraft
        : section === 'sent'
          ? () => undefined
          : section === 'snoozed'
            ? unsnooze
            : markDone;

  async function handleSend(mail: OutgoingMail, draftId?: string) {
    await sendEmail(mail);
    if (draftId) {
      deleteDraft(draftId).catch(() => undefined);
      setDrafts((list) => list?.filter((d) => d.draftId !== draftId) ?? null);
    }
    setView({ name: 'list' });
    if (section === 'sent') navigate('sent'); // refetch so the new mail shows
    showToast({ text: 'sent' });
  }

  async function handleSaveDraft(mail: OutgoingMail, draftId?: string) {
    await saveDraft(mail, draftId);
    setDrafts(null); // stale — refetched next time the section opens
    if (section === 'drafts') navigate('drafts');
    setView({ name: 'list' });
    showToast({ text: 'saved to drafts' });
  }

  // ⌘K toggles the palette from anywhere except the composer (where a
  // palette command could silently discard the draft).
  useEffect(() => {
    function onCmdK(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (emails !== null && view.name !== 'composing') setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onCmdK);
    return () => window.removeEventListener('keydown', onCmdK);
  }, [emails, view]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view.name === 'composing' || emails === null || paletteOpen) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (view.name === 'home') {
        const k = e.key.toLowerCase();
        if (k === 'i') navigate('inbox');
        else if (k === 'c') {
          e.preventDefault();
          setView({ name: 'composing' });
        } else if (k === 'd') navigate('drafts');
        else if (k === 'r') navigate('read');
        else if (k === 's') navigate('sent');
        else if (k === 'z') {
          e.preventDefault(); // keep the keystroke out of the autofocused reply box
          setView({ name: 'force' });
        }
        else if (k === 'f') {
          e.preventDefault();
          requestFeature();
        }
        return;
      }

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
        } else if (e.key.toLowerCase() === 'r' && selectedId && section !== 'drafts') {
          e.preventDefault(); // keep the keystroke out of the autofocused composer
          const email = activeList.find((m) => m.id === selectedId);
          if (email) setView({ name: 'composing', replyTo: email });
        } else if (e.key.toLowerCase() === 's' && selectedId && section === 'inbox') {
          const email = activeList.find((m) => m.id === selectedId);
          if (email) setSnoozeTarget(email);
        } else if (e.key.toLowerCase() === 'z' && section === 'inbox') {
          e.preventDefault(); // keep the keystroke out of the autofocused reply box
          setView({ name: 'force' });
        } else if (e.key.toLowerCase() === 'c' && section !== 'read') {
          e.preventDefault(); // keep the keystroke out of the autofocused composer
          setView({ name: 'composing' });
        } else if (e.key === 'Escape') {
          if (section !== 'inbox') setSection('inbox');
          else setView({ name: 'home' });
        }
      } else if (view.name === 'reading') {
        if (e.key.toLowerCase() === 'e') dismiss(view.id);
        else if (e.key === 'Escape') setView({ name: 'list' });
        else if (e.key.toLowerCase() === 's' && section === 'inbox') {
          const email = activeList.find((m) => m.id === view.id);
          if (email) setSnoozeTarget(email);
        } else if (e.key.toLowerCase() === 'r') {
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
  }, [view, activeList, selectedId, fadingIds, emails, section, drafts, paletteOpen]);

  // Tiny router: /privacy and /tos are standalone pages.
  const path = window.location.pathname;
  if (path === '/privacy' || path === '/tos') {
    return <Legal page={path === '/tos' ? 'tos' : 'privacy'} />;
  }

  if (emails === null) {
    const claimAccess = () => {
      try {
        localStorage.setItem(ACCESS_KEY, '1');
      } catch {
        // choice just won't persist
      }
      setGate('connect');
    };
    return (
      <div className="front">
        <header className="front-nav">
          <a className="front-brand" href="/">
            <SlipMark />
            slip
          </a>
          <nav className="front-links">
            <a href="#tour">features</a>
            <a href="#roadmap">what’s coming</a>
            <a href="https://github.com/Varun2009178/Slip" target="_blank" rel="noreferrer">
              github
            </a>
            <button className="front-signin" onClick={claimAccess}>
              sign in
            </button>
          </nav>
        </header>
        <section className="front-hero">
          <FrontScene />
          <div className="hero-sky">
            {gate === 'waitlist' ? (
              <Waitlist onHaveAccess={claimAccess} />
            ) : (
              <Connect error={connectError} onConnect={handleConnect} />
            )}
          </div>
        </section>
        <div className="video-stage">
          <video className="video-card" src="/slip_email.mp4" autoPlay muted loop playsInline />
        </div>
        <div className="front-body">
          <span className="sprig l1"><MeadowSprig /></span>
          <span className="sprig r1"><MeadowSprig flip /></span>
          <span className="sprig l2"><MeadowSprig flip /></span>
          <span className="sprig r2"><MeadowSprig /></span>
          <Showcase />
          <Roadmap />
        </div>
      </div>
    );
  }

  const readingEmail = view.name === 'reading' ? activeList.find((m) => m.id === view.id) : undefined;

  const dismissLabel =
    section === 'inbox' ? 'mark done' : section === 'read' ? 'restore to inbox' : 'delete draft';
  const commands: Command[] = [];
  if (readingEmail) {
    commands.push(
      { id: 'reply', label: 'reply', keys: 'R', run: () => setView({ name: 'composing', replyTo: readingEmail }) },
      { id: 'dismiss', label: dismissLabel, keys: 'E', run: () => dismiss(readingEmail.id) },
      { id: 'back', label: 'back to list', keys: 'Esc', run: () => setView({ name: 'list' }) },
    );
  } else if (view.name === 'list' && selectedId) {
    commands.push(
      { id: 'open', label: section === 'drafts' ? 'open draft' : 'open email', keys: '↵', run: () => openEmail(selectedId) },
      { id: 'dismiss', label: dismissLabel, keys: 'E', run: () => dismiss(selectedId) },
    );
    if (section === 'inbox') {
      const email = activeList.find((m) => m.id === selectedId);
      if (email) {
        commands.push(
          { id: 'reply', label: 'reply', keys: 'R', run: () => setView({ name: 'composing', replyTo: email }) },
          { id: 'snooze', label: 'snooze…', keys: 'S', run: () => setSnoozeTarget(email) },
        );
      }
    }
  }
  if (section === 'inbox' && view.name !== 'force' && inbox.length > 0) {
    commands.push({ id: 'force', label: 'force reply mode', keys: 'Z', run: () => setView({ name: 'force' }) });
  }
  commands.push({ id: 'compose', label: 'compose', keys: 'C', run: () => setView({ name: 'composing' }) });
  if (view.name !== 'campaigns') {
    commands.push({ id: 'go-outreach', label: 'go to outreach', run: () => setView({ name: 'campaigns' }) });
  }
  if (section !== 'inbox') commands.push({ id: 'go-inbox', label: 'go to inbox', run: () => navigate('inbox') });
  if (section !== 'read') commands.push({ id: 'go-read', label: 'go to read', run: () => navigate('read') });
  if (section !== 'snoozed') commands.push({ id: 'go-snoozed', label: 'go to snoozed', run: () => navigate('snoozed') });
  if (section !== 'sent') commands.push({ id: 'go-sent', label: 'go to sent', run: () => navigate('sent') });
  if (section !== 'drafts') commands.push({ id: 'go-drafts', label: 'go to drafts', run: () => navigate('drafts') });
  if (view.name !== 'home') {
    commands.push({ id: 'go-home', label: 'go to home', run: () => setView({ name: 'home' }) });
  }
  commands.push(
    { id: 'refresh', label: 'refresh inbox', run: refresh },
    { id: 'feature', label: 'request a feature', run: requestFeature },
    {
      id: 'start',
      label: start === 'keys' ? 'start in inbox after connecting' : 'start in outreach after connecting',
      run: toggleStart,
    },
    {
      id: 'theme',
      label: theme === 'paper' ? 'switch to plain theme' : 'switch to paper theme',
      run: () => setTheme((t) => (t === 'paper' ? 'default' : 'paper')),
    },
  );

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
        start={start}
        outreachActive={view.name === 'campaigns' || view.name === 'campaign' || view.name === 'thread'}
        onNavigate={navigate}
        onCompose={() => setView({ name: 'composing' })}
        onToggleTheme={() => setTheme((t) => (t === 'paper' ? 'default' : 'paper'))}
        onToggleStart={toggleStart}
        onRequestFeature={requestFeature}
        onHome={() => setView({ name: 'home' })}
        onOutreach={() => setView({ name: 'campaigns' })}
      />
      <main className="pane">
        {view.name === 'campaigns' && (
          <Campaigns
            campaigns={campaigns}
            onOpen={(id) => {
              const c = campaigns.find((x) => x.id === id);
              const step: WizardStep = c && c.state !== 'draft' ? 'send' : 'people';
              setView({ name: 'campaign', id, step });
            }}
            onNew={() => {
              const c = newCampaign();
              updateCampaign(c);
              setView({ name: 'campaign', id: c.id, step: 'people' });
            }}
          />
        )}
        {view.name === 'campaign' &&
          (() => {
            const c = campaigns.find((x) => x.id === view.id);
            if (!c) return null;
            return (
              <CampaignWizard
                campaign={c}
                step={view.step}
                selfEmail={selfEmail}
                onChange={updateCampaign}
                onStep={(step) => setView({ name: 'campaign', id: view.id, step })}
                onExit={() => setView({ name: 'campaigns' })}
                onChangeBy={(fn) => updateCampaignBy(view.id, fn)}
                onOpenReply={(threadId) => openOutreachReply(view.id, threadId)}
              />
            );
          })()}
        {view.name === 'thread' && (
          <Reader
            email={view.email}
            earlier={thread}
            fading={false}
            doneLabel={undefined}
            onBack={() => setView({ name: 'campaign', id: view.campaignId, step: 'send' })}
            onDone={() => undefined}
            onReply={() => setView({ name: 'composing', replyTo: view.email })}
          />
        )}
        {view.name === 'home' && (
          <Home
            onNavigate={navigate}
            onCompose={() => setView({ name: 'composing' })}
            onOpenPalette={() => setPaletteOpen(true)}
            onRequestFeature={requestFeature}
            onForceReply={() => setView({ name: 'force' })}
          />
        )}
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
            onOpenPalette={() => setPaletteOpen(true)}
            onForceReply={() => setView({ name: 'force' })}
          />
        )}
        {readingEmail && (
          <Reader
            email={readingEmail}
            earlier={thread}
            fading={fadingIds.includes(readingEmail.id)}
            doneLabel={
              section === 'sent'
                ? undefined
                : section === 'read'
                  ? 'restore'
                  : section === 'snoozed'
                    ? 'unsnooze'
                    : 'done'
            }
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
          prefill={view.prefill}
          onClose={() => setView({ name: 'list' })}
          onSend={handleSend}
          onSaveDraft={handleSaveDraft}
        />
      )}
      {view.name === 'force' && (
        <ForceReply
          queue={inbox}
          onReply={forceReplySend}
          onSnooze={forceSnooze}
          onArchive={forceArchive}
          onExit={() => setView({ name: 'list' })}
        />
      )}
      {snoozeTarget && (
        <WhenPicker
          title="snooze until…"
          options={snoozePresets(new Date())}
          onPick={(when) => snoozeEmail(snoozeTarget, when)}
          onClose={() => setSnoozeTarget(null)}
        />
      )}
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
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
