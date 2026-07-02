import type { Email } from '../lib/types';
import { formatDate } from '../lib/mail';

interface Props {
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
}

export default function Inbox({
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
}: Props) {
  return (
    <div>
      <header className="inbox-header">
        <h1>Inbox</h1>
        <div>
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === 'paper' ? 'Switch to plain theme' : 'Switch to paper theme'}
          >
            {theme === 'paper' ? '○' : '●'}
          </button>
          <button onClick={onRefresh} disabled={loading} title="Refresh">
            {loading ? '…' : '↻'}
          </button>
          <button onClick={onCompose}>
            Compose<kbd>C</kbd>
          </button>
        </div>
      </header>

      {emails.length === 0 ? (
        <p className="empty">All done.</p>
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
              <span className="pin">{email.starred ? '●' : ''}</span>
              <span className="from">{email.from}</span>
              <span className="subject-preview">
                <span className="subject">{email.subject}</span>
                {email.snippet}
              </span>
              <span className="date">{formatDate(email.date)}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="hints">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>E</kbd> done</span>
        <span><kbd>C</kbd> compose</span>
      </footer>
    </div>
  );
}
