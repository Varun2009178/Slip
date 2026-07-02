import { useMemo, useRef, useState } from 'react';
import type { Email } from '../lib/types';

// Sandboxed frame: no scripts run; links open in a new tab.
const FRAME_STYLE = `
  <base target="_blank">
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
           font-size: 15px; line-height: 1.6; color: #1c1c1a; background: transparent; word-break: break-word; }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
  </style>
`;

export default function EmailBody({ email }: { email: Pick<Email, 'body' | 'bodyHtml'> }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);
  const doc = useMemo(
    () => (email.bodyHtml ? FRAME_STYLE + email.bodyHtml : null),
    [email.bodyHtml],
  );

  if (!doc) {
    return (
      <div className="body">
        {email.body.split('\n\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  }

  return (
    <iframe
      ref={ref}
      className="html-body"
      title="Email content"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      style={{ height }}
      onLoad={() => {
        const d = ref.current?.contentDocument;
        if (d) setHeight(Math.min(d.documentElement.scrollHeight + 16, 20000));
      }}
    />
  );
}
