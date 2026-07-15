// Dev-only harness (/dev/shots?step=people|write|preview|send) that renders
// the outreach wizard with believable seeded data, so the landing page's
// feature screenshots can be captured without a connected Gmail account.
// Guarded by import.meta.env.DEV in App — never reachable in production.

import { useState } from 'react';
import CampaignWizard, { type WizardStep } from './CampaignWizard';
import { applyPaste, newCampaign, type Campaign } from '../lib/outreach';

const LIST =
  'name\temail\tpaper\n' +
  'Dr. Chen\tchen@cs.stanford.edu\tScaling Laws for Sparse Models\n' +
  'Prof. Okafor\tokafor@mit.edu\tVerified Compilation, Revisited\n' +
  'Dr. Ruiz\truiz@berkeley.edu\tEvals Without Human Labels\n' +
  'Prof. Adler\tadler@cmu.edu\tByzantine Consensus at Scale\n' +
  'Dr. Park\tpark@uw.edu\tProtein Folding on Consumer GPUs';

function seeded(step: WizardStep): Campaign {
  let c = applyPaste(newCampaign(), LIST);
  c = {
    ...c,
    name: 'professor outreach',
    subjectTemplate: 'quick question about {{paper}}',
    bodyTemplate:
      'hi {{name}},\n\n' +
      'i read {{paper}} last week and the ablation in section 4 changed how i think about my own project.\n\n' +
      "i'm an undergrad building an open-source outreach tool — could i ask you two short questions about the follow-up work?\n\n" +
      'thanks,\nvarun',
  };
  if (step === 'preview') {
    const r = c.recipients[1];
    c = {
      ...c,
      recipients: c.recipients.map((x) =>
        x.id === r.id
          ? {
              ...x,
              override: {
                subject: 'your talk at pldi (and one question)',
                body: 'hi prof. okafor,\n\ni was in the third row at your pldi talk — the live proof demo was the best thing i saw all week.\n\ncould i ask you two short questions about the follow-up work?\n\nthanks,\nvarun',
              },
            }
          : x,
      ),
    };
  }
  if (step === 'send') {
    c = {
      ...c,
      state: 'sending',
      recipients: c.recipients.map((r, i) =>
        i === 0
          ? { ...r, status: 'replied', messageId: 'm1', threadId: 't1' }
          : i === 1
            ? { ...r, status: 'replied', messageId: 'm2', threadId: 't2' }
            : i === 2
              ? { ...r, status: 'sent', messageId: 'm3', threadId: 't3' }
              : i === 3
                ? { ...r, status: 'sending' }
                : r,
      ),
    };
  }
  return c;
}

export default function DevShots() {
  const step = (new URLSearchParams(window.location.search).get('step') ?? 'people') as WizardStep;
  const [campaign, setCampaign] = useState(() => seeded(step));
  return (
    <div className="shell">
      <main className="pane">
        <CampaignWizard
          campaign={campaign}
          step={step}
          selfEmail={null}
          onChange={setCampaign}
          onChangeBy={(fn) => setCampaign((c) => fn(c))}
          onStep={() => undefined}
          onExit={() => undefined}
          onOpenReply={() => undefined}
        />
      </main>
    </div>
  );
}
