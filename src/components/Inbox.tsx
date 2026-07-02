import type { Email } from '../data/emails';
import { formatDate } from '../lib/mail';

interface Props {
  emails: Email[];
  readIds: string[];
  selectedId: string | null;
  fadingIds: string[];
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onCompose: () => void;
}

export default function Inbox({ emails, readIds, selectedId, fadingIds, onOpen, onSelect, onCompose }: Props) {
  return (
    <div>
      <header className="inbox-header">
        <h1>Inbox</h1>
        <button onClick={onCompose}>
          Compose<kbd>C</kbd>
        </button>
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
                readIds.includes(email.id) ? '' : 'unread',
                email.id === selectedId ? 'selected' : '',
                fadingIds.includes(email.id) ? 'fading' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => onSelect(email.id)}
              onClick={() => onOpen(email.id)}
            >
              <span className="pin">{email.important ? '●' : ''}</span>
              <span className="from">{email.from}</span>
              <span className="subject-preview">
                <span className="subject">{email.subject}</span>
                {email.body.replace(/\n+/g, ' ')}
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
