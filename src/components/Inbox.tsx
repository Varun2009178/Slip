import type { Email } from '../lib/types';
import { formatDate } from '../lib/mail';
import Avatar from './Avatar';

export type Section = 'inbox' | 'read' | 'drafts';

const TITLES: Record<Section, string> = { inbox: 'Inbox', read: 'Read', drafts: 'Drafts' };
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
  theme: 'default' | 'paper';
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onCompose: () => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
  onNavigate: (section: Section) => void;
}

export default function Inbox({
  mode,
  emails,
  selectedId,
  fadingIds,
  loading,
  theme,
  onOpen,
  onSelect,
  onCompose,
  onRefresh,
  onToggleTheme,
  onNavigate,
}: Props) {
  const isInbox = mode === 'inbox';
  return (
    <div>
      <header className="inbox-header">
        <h1>{TITLES[mode]}</h1>
        <div>
          {isInbox ? (
            <>
              <button onClick={() => onNavigate('drafts')}>Drafts</button>
              <button onClick={() => onNavigate('read')}>Read</button>
            </>
          ) : (
            <button onClick={() => onNavigate('inbox')}>← Inbox</button>
          )}
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === 'paper' ? 'Switch to plain theme' : 'Switch to paper theme'}
          >
            {theme === 'paper' ? '○' : '●'}
          </button>
          {isInbox && (
            <>
              <button onClick={onRefresh} disabled={loading} title="Refresh">
                {loading ? '…' : '↻'}
              </button>
              <button onClick={onCompose}>
                Compose<kbd>C</kbd>
              </button>
            </>
          )}
        </div>
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
        {isInbox && <span><kbd>C</kbd> compose</span>}
        <span><kbd>Esc</kbd> back</span>
      </footer>
    </div>
  );
}
