import { useState } from 'react';
import type { Email } from '../lib/types';
import { formatDate } from '../lib/mail';
import Avatar from './Avatar';
import EmailBody from './EmailBody';

interface Props {
  email: Email;
  earlier: Email[] | null; // null = thread still loading
  fading: boolean;
  doneLabel?: string; // 'Done' in inbox, 'Restore' in Read; absent in Sent
  onBack: () => void;
  onDone: () => void;
  onReply: () => void;
}

export default function Reader({ email, earlier, fading, doneLabel, onBack, onDone, onReply }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <header className="reader-nav">
        <button onClick={onBack}>
          ← back<kbd>Esc</kbd>
        </button>
        <div>
          <button onClick={onReply}>
            reply<kbd>R</kbd>
          </button>
          {doneLabel && (
            <button onClick={onDone}>
              {doneLabel}<kbd>E</kbd>
            </button>
          )}
        </div>
      </header>

      <article className={fading ? 'email fading' : 'email'}>
        <h1>{email.subject}</h1>
        <p className="meta sender">
          <Avatar name={email.from} email={email.fromEmail} />
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
              <EmailBody email={m} />
            </div>
          ))}

        <EmailBody email={email} />
      </article>
    </div>
  );
}
