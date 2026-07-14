import type { Campaign } from '../lib/outreach';
import RecipientTable from './RecipientTable';
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
  onStep: (s: WizardStep) => void;
  onExit: () => void;
  onOpenReply: (threadId: string) => void; // open a reply in Slip's reader — no tab switch
}

export default function CampaignWizard({
  campaign,
  step,
  selfEmail,
  onChange,
  onStep,
  onExit,
  onOpenReply: _onOpenReply,
}: Props) {
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
      {step === 'preview' && <p className="campaigns-empty">preview step coming in task 10</p>}
      {step === 'send' && <p className="campaigns-empty">send step coming in task 10</p>}
      {selfEmail === null && step === 'send' && null /* selfEmail is threaded to SendStep in task 10 */}
    </div>
  );
}
