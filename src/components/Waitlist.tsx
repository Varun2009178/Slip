import { useState } from 'react';

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

const EXCITED_OPTIONS = [
  'yes',
  'yes + 1',
  'yes + 2',
  'bro i genuinely cannot wait another day i need this app and will use it every single day',
] as const;
type Excited = (typeof EXCITED_OPTIONS)[number];

// The hero: nobody has access yet, so the very front is a waitlist.
export default function Waitlist({ onHaveAccess }: Props) {
  const [email, setEmail] = useState('');
  const [excited, setExcited] = useState<Excited | null>(null);
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
        // If the form service hangs (it has), fail into the mailto fallback
        // instead of an eternal "joining…".
        signal: AbortSignal.timeout(10_000),
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
    <div className="hero-wrap waitlist">
      <div className="hero-copy">
        <h1 className="hero-title">a super fast cold email inbox.</h1>
        <p className="hero-sub">
          send personalized batches from your own gmail. track and reply without switching tabs.
        </p>

        {state === 'done' ? (
          // already on the list: same hero + video, the form just becomes sign-in
          <button className="send connect-cta" onClick={onHaveAccess}>
            connect with Google
          </button>
        ) : (
          <>
            <div className="hero-form">
              <input
                className="hero-field"
                type="email"
                placeholder="enter email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && join()}
              />
              <button className="send hero-join" onClick={join} disabled={!valid || state === 'sending'}>
                {state === 'sending' ? 'joining…' : 'join the waitlist'}
              </button>
            </div>
            <p className="waitlist-q">are you excited to try the best email in the world?</p>
            <div className="waitlist-opts">
              {EXCITED_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={excited === option ? 'opt active' : 'opt'}
                  onClick={() => setExcited(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            {state === 'error' && (
              <p className="ai-error">
                couldn't join.{' '}
                <a href="mailto:varun@teyra.app?subject=slip%20waitlist">email varun@teyra.app</a>{' '}
                instead
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
