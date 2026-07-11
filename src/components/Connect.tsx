import { useState } from 'react';
import { getClientId, setClientId } from '../lib/gmail';

interface Props {
  error: string | null;
  onConnect: () => void;
}

// Shown when Google turns someone away (not on the test-user list).
export const DENIED_ERROR = "sorry, you aren't cool enough to access slip yet. dm vazuzu_varun on X!";

// An envelope with a paper slip that rises out of it on load. The pocket is
// drawn after the slip and filled, so the slip stays hidden "inside" until
// the animation lifts it above the pocket's top edge. Also played by the
// sign-in transition overlay in App.
export function SlipAnimation() {
  return (
    <svg className="slip-logo" width="88" height="88" viewBox="0 0 96 96" aria-hidden="true">
      <g className="slip-paper">
        <rect x="30" y="18" width="36" height="30" rx="3" fill="#ffffff" stroke="#1d1c1a" strokeWidth="2.5" />
        <line x1="37" y1="27" x2="59" y2="27" stroke="#c9c8c5" strokeWidth="2" strokeLinecap="round" />
        <line x1="37" y1="34" x2="59" y2="34" stroke="#c9c8c5" strokeWidth="2" strokeLinecap="round" />
        <line x1="37" y1="41" x2="51" y2="41" stroke="#c9c8c5" strokeWidth="2" strokeLinecap="round" />
      </g>
      <rect x="16" y="46" width="64" height="34" rx="6" fill="#ffffff" stroke="#1d1c1a" strokeWidth="2.5" />
      <path d="M18 50 L48 66 L78 50" fill="none" stroke="#1d1c1a" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function Connect({ error, onConnect }: Props) {
  const [hasClientId, setHasClientId] = useState(() => !!getClientId());
  const [idInput, setIdInput] = useState('');

  function saveClientId() {
    const id = idInput.trim();
    if (!id) return;
    setClientId(id);
    setHasClientId(true);
  }

  return (
    <div className="connect">
      <SlipAnimation />
      <h1 className="connect-sentence">
        <strong>Slip</strong>, the most minimal email on the web.
      </h1>
      <p className="connect-tag">Built for busy people.</p>
      <p className="connect-mobile">100,000x better on a computer.</p>
      {hasClientId ? (
        <button className="send connect-cta" onClick={onConnect}>
          Connect Gmail
        </button>
      ) : (
        <>
          <p className="connect-note">
            One-time setup: paste your Google OAuth Client ID. It stays in this browser.
          </p>
          <input
            className="field"
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveClientId()}
          />
          <button className="send" onClick={saveClientId} disabled={!idInput.trim()}>
            Save
          </button>
          <details className="connect-steps">
            <summary>How to get a Client ID (~5 min)</summary>
            <ol>
              <li>Go to console.cloud.google.com and create a project (any name).</li>
              <li>APIs &amp; Services → Library → enable “Gmail API”.</li>
              <li>
                APIs &amp; Services → OAuth consent screen → External → fill in the app name and
                your email → under Test users, add your own Gmail address.
              </li>
              <li>
                APIs &amp; Services → Credentials → Create credentials → OAuth client ID → Web
                application → add <code>http://localhost:5173</code> to Authorized JavaScript
                origins.
              </li>
              <li>Copy the Client ID here.</li>
            </ol>
          </details>
        </>
      )}
      {error === DENIED_ERROR ? (
        <p className="connect-denied">
          sorry, you aren't cool enough to access slip yet.{' '}
          <a href="https://x.com/vazuzu_varun" target="_blank" rel="noreferrer">
            dm vazuzu_varun on X!
          </a>
        </p>
      ) : (
        error && <p className="ai-error">{error}</p>
      )}
    </div>
  );
}
