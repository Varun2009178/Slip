import type { Campaign } from '../lib/outreach';
import PreviewStep from './PreviewStep';
import RecipientTable from './RecipientTable';
import SendStep from './SendStep';
import TemplateStep from './TemplateStep';

export type WizardStep = 'people' | 'write' | 'preview' | 'send';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'people', label: '1 · people' },
  { key: 'write', label: '2 · write' },
  { key: 'preview', label: '3 · preview' },
  { key: 'send', label: '4 · send' },
];

interface Props {
  campaign: Campaign;
  step: WizardStep;
  selfEmail: string | null;
  onChange: (c: Campaign) => void;
  onChangeBy: (fn: (prev: Campaign) => Campaign) => void; // functional writes for async producers
  onStep: (s: WizardStep) => void;
  onExit: () => void;
  onOpenReply: (threadId: string) => void; // open a reply in Slip's reader — no tab switch
}

export default function CampaignWizard({ campaign, step, selfEmail, onChange, onChangeBy, onStep, onExit, onOpenReply }: Props) {
  return (
    <div className="wizard">
      <div className="wizard-head">
        <button className="wizard-back" onClick={onExit}>
          ← batches
        </button>
        <input
          className="wizard-name"
          value={campaign.name}
          onChange={(e) => onChange({ ...campaign, name: e.target.value })}
        />
        <nav className="wizard-steps">
          {STEPS.map(({ key, label }) => (
            <button
              key={key}
              className={key === step ? 'wizard-step active' : 'wizard-step'}
              // Mid-run edits to people/write would desync the live queue;
              // paused/done campaigns stay fully navigable.
              disabled={campaign.state === 'sending' && (key === 'people' || key === 'write')}
              onClick={() => onStep(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      {step === 'people' && (
        <RecipientTable campaign={campaign} onChange={onChange} onNext={() => onStep('write')} />
      )}
      {step === 'write' && (
        <TemplateStep
          campaign={campaign}
          onChange={onChange}
          onBack={() => onStep('people')}
          onNext={() => onStep('preview')}
        />
      )}
      {step === 'preview' && (
        <PreviewStep
          campaign={campaign}
          onChange={onChange}
          onBack={() => onStep('write')}
          onNext={() => onStep('send')}
        />
      )}
      {step === 'send' && (
        <SendStep
          campaign={campaign}
          selfEmail={selfEmail}
          onChange={onChange}
          onChangeBy={onChangeBy}
          onOpenReply={onOpenReply}
        />
      )}
    </div>
  );
}
