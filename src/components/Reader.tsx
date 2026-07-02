import { useState } from 'react';
import type { Email } from '../lib/types';
import { formatDate } from '../lib/mail';

interface Props {
  email: Email;
  earlier: Email[] | null; // null = thread still loading
  fading: boolean;
  onBack: () => void;
  onDone: () => void;
  onReply: () => void;
}

export default function Reader({ email, earlier, fading, onBack, onDone, onReply }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <header className="reader-nav">
        <button onClick={onBack}>
          ← Inbox<kbd>Esc</kbd>
        </button>
        <div>
          <button onClick={onReply}>
            Reply<kbd>R</kbd>
          </button>
          <button onClick={onDone}>
            Done<kbd>E</kbd>
          </button>
        </div>
      </header>

      <article className={fading ? 'email fading' : 'email'}>
        <h1>{email.subject}</h1>
        <p className="meta">
          {email.from} <span>&lt;{email.fromEmail}&gt;</span> · {formatDate(email.date)}
        </p>

        {earlier && earlier.length > 0 && !expanded && (
          <button className="thread-toggle" onClick={() => setExpanded(true)}>
            {earlier.length} earlier {earlier.length === 1 ? 'message' : 'messages'}
          </button>
        )}
        {expanded &&
          earlier?.map((m) => (
            <div key={m.id} className="thread-message">
              <p className="meta">
                {m.from} · {formatDate(m.date)}
              </p>
              <div className="body">
                {m.body.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          ))}

        <div className="body">
          {email.body.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
