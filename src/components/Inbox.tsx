import type { Email } from '../lib/types';
import { formatDate } from '../lib/mail';
import Avatar from './Avatar';
import { IconCheck, IconDraft, IconInbox } from './icons';

export type Section = 'inbox' | 'read' | 'drafts';

const TITLES: Record<Section, string> = { inbox: 'Inbox', read: 'Read', drafts: 'Drafts' };
const ICONS: Record<Section, React.ReactNode> = {
  inbox: <IconInbox />,
  read: <IconCheck />,
  drafts: <IconDraft />,
};
const EMPTY: Record<Section, string> = {
  inbox: 'All done.',
  read: 'Nothing here yet — press E on an email.',
  drafts: 'No drafts — ⌘S in the composer saves one.',
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
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
        <button className="pane-action" onClick={onOpenPalette} title="Command palette (⌘K)">
          <kbd className="pane-kbd">⌘K</kbd> commands
        </button>
      </header>

      {loading && emails.length === 0 ? (
        <p className="empty">Loading…</p>
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
        <span><kbd>E</kbd> {mode === 'inbox' ? 'done' : mode === 'read' ? 'restore' : 'delete'}</span>
        {mode === 'inbox' && <span><kbd>C</kbd> compose</span>}
        <span><kbd>⌘K</kbd> commands</span>
        <span><kbd>Esc</kbd> back</span>
      </footer>
    </div>
  );
}
