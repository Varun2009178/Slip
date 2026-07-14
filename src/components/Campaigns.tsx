import type { Campaign } from '../lib/outreach';

interface Props {
  campaigns: Campaign[];
  onOpen: (id: string) => void;
  onNew: () => void;
}

const STATE_LABEL: Record<Campaign['state'], string> = {
  draft: 'draft',
  sending: 'sending…',
  paused: 'paused',
  done: 'sent',
};

export default function Campaigns({ campaigns, onOpen, onNew }: Props) {
  return (
    <div className="campaigns">
      <div className="campaigns-head">
        <h1>outreach</h1>
        <button className="send" onClick={onNew}>
          new batch
        </button>
      </div>
      {campaigns.length === 0 ? (
        <p className="campaigns-empty">
          paste a list, write one email with {'{{variables}}'}, preview every single one, and slip
          sends them a couple of minutes apart from your own gmail.
        </p>
      ) : (
        <ul className="campaign-list">
          {campaigns.map((c) => {
            const sent = c.recipients.filter((r) => r.status === 'sent' || r.status === 'replied');
            const replied = c.recipients.filter((r) => r.status === 'replied');
            return (
              <li key={c.id}>
                <button className="campaign-row" onClick={() => onOpen(c.id)}>
                  <span className="campaign-name">{c.name}</span>
                  <span className={`campaign-state is-${c.state}`}>{STATE_LABEL[c.state]}</span>
                  <span className="campaign-stats">
                    {sent.length}/{c.recipients.length} sent · {replied.length} replied
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
