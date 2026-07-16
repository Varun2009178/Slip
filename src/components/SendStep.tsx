import { useEffect, useRef } from 'react';
import { fetchThread } from '../lib/gmail';
import {
  blockingIssues,
  hasBounce,
  hasReply,
  recordBounced,
  recordReplied,
  retryRecipient,
  validateCampaign,
  type Campaign,
  type Recipient,
} from '../lib/outreach';

interface Props {
  campaign: Campaign;
  selfEmail: string | null;
  onChange: (c: Campaign) => void;
  onChangeBy: (fn: (prev: Campaign) => Campaign) => void;
  onOpenReply: (threadId: string) => void;
}

const STATUS_LABEL: Record<Recipient['status'], string> = {
  queued: 'queued',
  sending: 'sending…',
  sent: 'sent',
  failed: 'did not send',
  replied: 'replied',
  bounced: 'bounced',
};

const ICON_PATHS: Record<Recipient['status'], React.ReactNode> = {
  queued: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  sending: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <path d="M22 2 15 22 11 13 2 9 22 2z" />
    </>
  ),
  sent: <polyline points="20 6 9 17 4 12" />,
  failed: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  replied: (
    <>
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </>
  ),
  bounced: (
    <>
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </>
  ),
};

function StatusChip({ status }: { status: Recipient['status'] }) {
  return (
    // Keyed on status where it's rendered, so a flip remounts the chip and
    // replays the pop-in animation.
    <span className={`status-chip is-${status}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICON_PATHS[status]}
      </svg>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Tiles are one bucket per recipient; sending rides with queued so the tile
// row stays calm while the loop works. Failure tiles only appear once real.
const TILES: { key: keyof Tally; label: string; always?: boolean }[] = [
  { key: 'sent', label: 'sent', always: true },
  { key: 'replied', label: 'replied', always: true },
  { key: 'queued', label: 'queued' },
  { key: 'failed', label: 'did not send' },
  { key: 'bounced', label: 'bounced' },
];

interface Tally {
  queued: number;
  sent: number;
  replied: number;
  failed: number;
  bounced: number;
}

function tally(recipients: Recipient[]): Tally {
  const t: Tally = { queued: 0, sent: 0, replied: 0, failed: 0, bounced: 0 };
  for (const r of recipients) t[r.status === 'sending' ? 'queued' : r.status] += 1;
  return t;
}

const POLL_MS = 60_000;

export default function SendStep({ campaign, selfEmail, onChange, onChangeBy, onOpenReply }: Props) {
  // Freshest campaign for the async reply poll — never write a stale snapshot
  // back over updates that landed while a fetch was in flight.
  const live = useRef(campaign);
  live.current = campaign;

  const blockers = blockingIssues(validateCampaign(campaign));
  const t = tally(campaign.recipients);
  const delivered = t.sent + t.replied + t.bounced;
  const total = campaign.recipients.length;

  // Reply & bounce tracking: on open and every minute, look at each sent
  // thread; a mailer-daemon message means it bounced, anyone else replying
  // flips it to replied.
  useEffect(() => {
    if (!selfEmail) return;
    let cancelled = false;
    async function check() {
      for (const r of live.current.recipients) {
        if (cancelled) return;
        if (r.status !== 'sent' || !r.threadId) continue;
        try {
          const thread = await fetchThread(r.threadId);
          if (cancelled) return;
          // Functional fold over React's authoritative state — a write built
          // from any snapshot could clobber a same-tick send-loop update.
          if (hasBounce(thread)) onChangeBy((prev) => recordBounced(prev, r.id));
          else if (hasReply(thread, selfEmail!)) onChangeBy((prev) => recordReplied(prev, r.id));
        } catch {
          // stale status is fine; next tick retries
        }
      }
    }
    void check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // The live ref keeps each tick fresh; onChange identity churn must not restart the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfEmail, campaign.id]);

  const banner =
    campaign.state === 'sending'
      ? 'sending one every 1–2 minutes — keep this tab open'
      : campaign.state === 'paused'
        ? 'paused — nothing is sending'
        : campaign.state === 'done'
          ? `all done — ${delivered}/${total} sent, ${t.replied} replied`
          : `ready — ${total} emails will go out one every 1–2 minutes`;

  return (
    <div className="send-step">
      <div className={`send-banner is-${campaign.state}`}>
        <span>{banner}</span>
        {campaign.state === 'draft' && (
          <button
            className="send"
            disabled={blockers.length > 0}
            onClick={() => onChange({ ...campaign, state: 'sending' })}
          >
            start sending
          </button>
        )}
        {campaign.state === 'sending' && (
          <button className="ghost" onClick={() => onChange({ ...campaign, state: 'paused' })}>
            pause
          </button>
        )}
        {campaign.state === 'paused' && (
          <button className="send" onClick={() => onChange({ ...campaign, state: 'sending' })}>
            resume
          </button>
        )}
      </div>
      {blockers.length > 0 && campaign.state === 'draft' && (
        <ul className="issue-list">
          {blockers.map((i, n) => (
            <li key={n} className="issue-block">
              {i.message}
            </li>
          ))}
        </ul>
      )}
      <div className="send-tiles">
        {TILES.filter((tile) => tile.always || t[tile.key] > 0).map((tile) => (
          <div key={tile.key} className={`send-tile is-${tile.key}`}>
            {/* Keyed on the count so each tick-up replays the bounce. */}
            <span key={t[tile.key]} className="tile-num">
              {t[tile.key]}
            </span>
            <span className="tile-label">{tile.label}</span>
          </div>
        ))}
      </div>
      <ul className="send-list">
        {campaign.recipients.map((r) => (
          <li key={r.id} className="send-row">
            <span className="preview-to">{r.fields.email}</span>
            <StatusChip key={r.status} status={r.status} />
            {r.status === 'replied' && r.threadId && (
              <button className="ghost" onClick={() => onOpenReply(r.threadId!)}>
                open reply →
              </button>
            )}
            {r.status === 'bounced' && r.threadId && (
              <button className="ghost" onClick={() => onOpenReply(r.threadId!)}>
                view bounce →
              </button>
            )}
            {r.status === 'failed' && (
              <>
                <span className="send-error" title={r.error}>
                  {r.error}
                </span>
                <button className="ghost" onClick={() => onChange(retryRecipient(campaign, r.id))}>
                  retry
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
