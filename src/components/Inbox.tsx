import type { Email } from '../lib/types';
import { formatDate } from '../lib/mail';
import Avatar from './Avatar';
import { IconCheck, IconClock, IconDraft, IconInbox, IconSent } from './icons';

export type Section = 'inbox' | 'read' | 'snoozed' | 'sent' | 'drafts';

const TITLES: Record<Section, string> = {
  inbox: 'Inbox',
  read: 'Read',
  snoozed: 'Snoozed',
  sent: 'Sent',
  drafts: 'Drafts',
};
const ICONS: Record<Section, React.ReactNode> = {
  inbox: <IconInbox />,
  read: <IconCheck />,
  snoozed: <IconClock />,
  sent: <IconSent />,
  drafts: <IconDraft />,
};
const EMPTY: Record<Section, string> = {
  inbox: 'all done.',
  read: 'nothing here yet. press e on an email.',
  snoozed: 'nothing snoozed. press s on an email.',
  sent: 'nothing sent yet. press c.',
  drafts: 'no drafts. ⌘s in the composer saves one.',
};

interface Props {
  mode: Section;
  emails: Email[];
  selectedId: string | null;
  fadingIds: string[];
  loading: boolean;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onOpenPalette: () => void;
  onForceReply: () => void;
}

export default function Inbox({
  mode,
  emails,
  selectedId,
  fadingIds,
  loading,
  onOpen,
  onSelect,
  onRefresh,
  onOpenPalette,
  onForceReply,
}: Props) {
  return (
    <div>
      <header className="pane-head">
        <h1>
          {ICONS[mode]}
          {TITLES[mode]}
        </h1>
        {mode === 'inbox' && (
          <button className="pane-action" onClick={onRefresh} disabled={loading}>
            {loading ? 'refreshing…' : 'refresh'}
          </button>
        )}
        <button className="pane-action" onClick={onOpenPalette} title="Command palette (⌘K)">
          <kbd className="pane-kbd">⌘K</kbd> commands
        </button>
      </header>

      {mode === 'inbox' && emails.length > 0 && (
        <button className="force-promo" onClick={onForceReply}>
          <span className="force-promo-title">force reply</span>
          <span className="force-promo-copy">
            your inbox, one email at a time. reply, snooze, or mark done. most people clear ten in
            a minute.
          </span>
          <span className="force-promo-go">
            start <kbd>Z</kbd>
          </span>
        </button>
      )}

      {loading && emails.length === 0 ? (
        <p className="empty">loading…</p>
      ) : emails.length === 0 ? (
        <p className="empty">{EMPTY[mode]}</p>
      ) : (
        <ul className="email-list">
          {emails.map((email) => (
            <li
              key={email.id}
              className={[
                'email-row',
                email.unread ? 'unread' : '',
                email.id === selectedId ? 'selected' : '',
                fadingIds.includes(email.id) ? 'fading' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => onSelect(email.id)}
              onClick={() => onOpen(email.id)}
            >
              <Avatar name={email.from} email={email.fromEmail} />
              <span className="from">{email.from}</span>
              <span className="subject-preview">
                <span className="subject">{email.subject}</span>
                {email.snippet}
              </span>
              <span className="date">
                {email.starred && <span className="star">★ </span>}
                {formatDate(email.date)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <footer className="hints">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        {mode !== 'sent' && (
          <span>
            <kbd>E</kbd>{' '}
            {mode === 'inbox' ? 'done' : mode === 'read' ? 'restore' : mode === 'snoozed' ? 'unsnooze' : 'delete'}
          </span>
        )}
        {mode === 'inbox' && <span><kbd>R</kbd> reply</span>}
        {mode === 'inbox' && <span><kbd>S</kbd> snooze</span>}
        {mode === 'inbox' && <span><kbd>Z</kbd> force reply</span>}
        {mode === 'inbox' && <span><kbd>C</kbd> compose</span>}
        <span><kbd>⌘K</kbd> commands</span>
        <span><kbd>Esc</kbd> back</span>
      </footer>
    </div>
  );
}
