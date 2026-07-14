import { useState } from 'react';
import { renderedFor, type Campaign } from '../lib/outreach';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function PreviewStep({ campaign, onChange, onBack, onNext }: Props) {
  const [openId, setOpenId] = useState<string | null>(campaign.recipients[0]?.id ?? null);
  const open = campaign.recipients.find((r) => r.id === openId) ?? null;
  const rendered = open ? renderedFor(campaign, open) : null;

  function setOverride(patch: Partial<{ subject: string; body: string }>) {
    if (!open || !rendered) return;
    const override = { ...rendered, ...patch };
    onChange({
      ...campaign,
      recipients: campaign.recipients.map((r) => (r.id === open.id ? { ...r, override } : r)),
    });
  }

  function revert() {
    if (!open) return;
    onChange({
      ...campaign,
      recipients: campaign.recipients.map((r) =>
        r.id === open.id ? { ...r, override: undefined } : r,
      ),
    });
  }

  return (
    <div className="preview-step">
      <ul className="preview-list">
        {campaign.recipients.map((r) => (
          <li key={r.id}>
            <button
              className={r.id === openId ? 'preview-row active' : 'preview-row'}
              onClick={() => setOpenId(r.id)}
            >
              <span className="preview-to">{r.fields.email || '(no email)'}</span>
              {r.override && <span className="edited-badge">edited</span>}
            </button>
          </li>
        ))}
      </ul>
      {open && rendered && (
        <div className="preview-pane">
          <input
            className="field"
            value={rendered.subject}
            onChange={(e) => setOverride({ subject: e.target.value })}
          />
          <textarea
            className="field preview-body"
            value={rendered.body}
            onChange={(e) => setOverride({ body: e.target.value })}
          />
          <div className="preview-meta">
            {open.override ? (
              <button className="ghost" onClick={revert}>
                revert to template
              </button>
            ) : (
              <span className="step-hint">editing here changes only this one email</span>
            )}
          </div>
        </div>
      )}
      <div className="step-actions preview-actions">
        <button className="ghost" onClick={onBack}>
          ← write
        </button>
        <button className="send" onClick={onNext}>
          looks right — go to send →
        </button>
      </div>
    </div>
  );
}
