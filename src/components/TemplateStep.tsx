import { useRef } from 'react';
import { blockingIssues, validateCampaign, type Campaign } from '../lib/outreach';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function TemplateStep({ campaign, onChange, onBack, onNext }: Props) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertVar(col: string) {
    const el = bodyRef.current;
    const token = `{{${col}}}`;
    if (!el) {
      onChange({ ...campaign, bodyTemplate: campaign.bodyTemplate + token });
      return;
    }
    const { selectionStart: s, selectionEnd: e, value } = el;
    const bodyTemplate = value.slice(0, s) + token + value.slice(e);
    onChange({ ...campaign, bodyTemplate });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  }

  const issues = validateCampaign(campaign);
  const blockers = blockingIssues(issues);
  const warnings = issues.filter((i) => i.kind === 'empty-value');

  return (
    <div className="write-step">
      <input
        className="field"
        placeholder="subject — {{variables}} work here too"
        value={campaign.subjectTemplate}
        onChange={(e) => onChange({ ...campaign, subjectTemplate: e.target.value })}
      />
      <div className="var-chips">
        {campaign.columns
          .filter((c) => c !== 'email')
          .map((col) => (
            <button key={col} className="var-chip" onClick={() => insertVar(col)}>
              {'{{' + col + '}}'}
            </button>
          ))}
      </div>
      <textarea
        ref={bodyRef}
        className="field body-tpl"
        placeholder={'hi {{name}},\n\ni read {{paper}} and…'}
        value={campaign.bodyTemplate}
        onChange={(e) => onChange({ ...campaign, bodyTemplate: e.target.value })}
      />
      {(blockers.length > 0 || warnings.length > 0) && (
        <ul className="issue-list">
          {blockers.map((i, n) => (
            <li key={`b${n}`} className="issue-block">
              {i.message}
            </li>
          ))}
          {warnings.length > 0 && (
            <li className="issue-warn">
              {warnings.length} value{warnings.length === 1 ? ' is' : 's are'} empty — those emails
              will keep the literal {'{{variable}}'} unless you edit them in preview
            </li>
          )}
        </ul>
      )}
      <div className="step-actions">
        <button className="ghost" onClick={onBack}>
          ← people
        </button>
        <button
          className="send"
          disabled={blockers.length > 0 || !campaign.subjectTemplate.trim() || !campaign.bodyTemplate.trim()}
          onClick={onNext}
        >
          preview every email →
        </button>
      </div>
    </div>
  );
}
