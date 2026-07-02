import type { Email } from '../lib/types';
import { formatDate } from '../lib/mail';
import Avatar from './Avatar';

interface Props {
  mode: 'inbox' | 'read';
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
  onSwitchView: () => void;
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
  onSwitchView,
}: Props) {
  const isRead = mode === 'read';
  return (
    <div>
      <header className="inbox-header">
        <h1>{isRead ? 'Read' : 'Inbox'}</h1>
        <div>
          <button onClick={onSwitchView}>{isRead ? '← Inbox' : 'Read'}</button>
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === 'paper' ? 'Switch to plain theme' : 'Switch to paper theme'}
          >
            {theme === 'paper' ? '○' : '●'}
          </button>
          {!isRead && (
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
        <p className="empty">{isRead ? 'Nothing here yet — press E on an email.' : 'All done.'}</p>
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
        <span><kbd>E</kbd> {isRead ? 'restore' : 'done'}</span>
        {!isRead && <span><kbd>C</kbd> compose</span>}
        <span><kbd>Esc</kbd> back</span>
      </footer>
    </div>
  );
}
