import { useState } from 'react';
import { getClientId, setClientId } from '../lib/gmail';

interface Props {
  error: string | null;
  onConnect: () => void;
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
      <h1>Mail</h1>
      {hasClientId ? (
        <>
          <p className="connect-note">Sign in with Google to load your inbox.</p>
          <button className="send" onClick={onConnect}>
            Connect Gmail
          </button>
          <button className="connect-reset" onClick={() => setHasClientId(false)}>
            Use a different Client ID
          </button>
        </>
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
      {error && <p className="ai-error">{error}</p>}
    </div>
  );
}
