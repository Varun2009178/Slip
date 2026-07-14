import { useEffect } from 'react';
import { fetchThread } from '../lib/gmail';
import {
  blockingIssues,
  hasReply,
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
  onOpenReply: (threadId: string) => void;
}

const STATUS_LABEL: Record<Recipient['status'], string> = {
  queued: 'queued',
  sending: 'sending…',
  sent: 'sent',
  failed: 'failed',
  replied: 'replied ✓',
};

const POLL_MS = 60_000;

export default function SendStep({ campaign, selfEmail, onChange, onOpenReply }: Props) {
  const blockers = blockingIssues(validateCampaign(campaign));
  const counts = {
    sent: campaign.recipients.filter((r) => r.status === 'sent' || r.status === 'replied').length,
    replied: campaign.recipients.filter((r) => r.status === 'replied').length,
    failed: campaign.recipients.filter((r) => r.status === 'failed').length,
    total: campaign.recipients.length,
  };

  // Reply tracking: on open and every minute, look at each sent thread and
  // flip to replied when someone who isn't the sender shows up in it.
  useEffect(() => {
    if (!selfEmail) return;
    let cancelled = false;
    async function check() {
      let current = campaign;
      for (const r of campaign.recipients) {
        if (cancelled) return;
        if (r.status !== 'sent' || !r.threadId) continue;
        try {
          const thread = await fetchThread(r.threadId);
          if (cancelled) return;
          if (hasReply(thread, selfEmail!)) current = recordReplied(current, r.id);
        } catch {
          // stale status is fine; next tick retries
        }
      }
      if (!cancelled && current !== campaign) onChange(current);
    }
    void check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // Re-keying on sent-count keeps the poll fresh without restarting per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfEmail, campaign.id, counts.sent]);

  const banner =
    campaign.state === 'sending'
      ? 'sending one every 1–2 minutes — keep this tab open'
      : campaign.state === 'paused'
        ? 'paused — nothing is sending'
        : campaign.state === 'done'
          ? `all done — ${counts.sent}/${counts.total} sent, ${counts.replied} replied`
          : `ready — ${counts.total} emails will go out one every 1–2 minutes`;

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
      <ul className="send-list">
        {campaign.recipients.map((r) => (
          <li key={r.id} className="send-row">
            <span className="preview-to">{r.fields.email}</span>
            <span className={`send-status is-${r.status}`}>{STATUS_LABEL[r.status]}</span>
            {r.status === 'replied' && r.threadId && (
              <button className="ghost" onClick={() => onOpenReply(r.threadId!)}>
                open reply →
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
