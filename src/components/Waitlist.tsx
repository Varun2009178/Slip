import { useState } from 'react';
import { SlipAnimation } from './Connect';

interface Props {
  onHaveAccess: () => void;
}

// formsubmit.co alias for varun@teyra.app — keeps the raw address out of the bundle.
const WAITLIST_ENDPOINT = 'https://formsubmit.co/ajax/f9813b66e3f163ee34cce515e4e66acf';
const JOINED_KEY = 'slip-waitlisted';

function alreadyJoined(): boolean {
  try {
    return !!localStorage.getItem(JOINED_KEY);
  } catch {
    return false;
  }
}

// The very front: nobody has access yet, so the hero is a waitlist.
export default function Waitlist({ onHaveAccess }: Props) {
  const [email, setEmail] = useState('');
  const [excited, setExcited] = useState<'yes' | 'yes + 1' | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>(() =>
    alreadyJoined() ? 'done' : 'idle',
  );

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && excited !== null;

  async function join() {
    if (!valid || state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: 'slip waitlist', email: email.trim(), excited }),
      });
      if (!res.ok) throw new Error('waitlist-failed');
      try {
        localStorage.setItem(JOINED_KEY, email.trim());
      } catch {
        // they'll just see the form again next visit
      }
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="connect waitlist">
      <SlipAnimation />
      <h1 className="connect-sentence">
        <strong>Slip</strong>, the most minimal email on the web.
      </h1>
      <p className="connect-tag">Built for busy people.</p>
      {state === 'done' ? (
        <p className="waitlist-done">you're on the list. we'll email you when your seat opens.</p>
      ) : (
        <>
          <input
            className="field"
            type="email"
            placeholder="enter email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <p className="waitlist-q">are you excited to try the best email in the world?</p>
          <div className="waitlist-opts">
            <button
              className={excited === 'yes' ? 'opt active' : 'opt'}
              onClick={() => setExcited('yes')}
            >
              yes
            </button>
            <button
              className={excited === 'yes + 1' ? 'opt active' : 'opt'}
              onClick={() => setExcited('yes + 1')}
            >
              yes + 1
            </button>
          </div>
          <button className="send connect-cta" onClick={join} disabled={!valid || state === 'sending'}>
            {state === 'sending' ? 'joining…' : 'join the waitlist'}
          </button>
          {state === 'error' && (
            <p className="ai-error">
              couldn't join.{' '}
              <a href="mailto:varun@teyra.app?subject=slip%20waitlist">email varun@teyra.app</a>{' '}
              instead
            </p>
          )}
        </>
      )}
      <button className="waitlist-access" onClick={onHaveAccess}>
        already have access? sign in
      </button>
    </div>
  );
}
