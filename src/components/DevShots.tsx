// Dev-only harness (/dev/shots?step=people|write|preview|send) that renders
// the outreach wizard with believable seeded data, so the landing page's
// feature screenshots can be captured without a connected Gmail account.
// Guarded by import.meta.env.DEV in App — never reachable in production.

import { useState } from 'react';
import CampaignWizard, { type WizardStep } from './CampaignWizard';
import Inbox from './Inbox';
import Sidebar from './Sidebar';
import { applyPaste, newCampaign, type Campaign } from '../lib/outreach';
import type { Email } from '../lib/types';

type ShotStep = WizardStep | 'inbox';

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

const reply = (
  id: string,
  from: string,
  fromEmail: string,
  subject: string,
  snippet: string,
  minsAgo: number,
  unread: boolean,
): Email => ({
  id,
  threadId: `t-${id}`,
  rfcMessageId: '',
  from,
  fromEmail,
  subject,
  snippet,
  body: snippet,
  bodyHtml: null,
  date: new Date(Date.now() - minsAgo * 60_000).toISOString(),
  unread,
  starred: false,
});

const REPLIES: Email[] = [
  reply('1', 'Dr. Chen', 'chen@cs.stanford.edu', 'Re: quick question about Scaling Laws for Sparse Models', 'happy to answer — section 4 took us three months to get right. send the questions over, or grab 15 min on my calendar.', 12, true),
  reply('2', 'Prof. Okafor', 'okafor@mit.edu', 'Re: your talk at pldi (and one question)', 'ha, the live demo nearly fell over backstage. yes — ask away.', 47, true),
  reply('3', 'Dr. Ruiz', 'ruiz@berkeley.edu', 'Re: quick question about Evals Without Human Labels', 'good timing, we just pushed the follow-up preprint. what are you building?', 180, false),
  reply('4', 'Prof. Adler', 'adler@cmu.edu', 'Re: quick question about Byzantine Consensus at Scale', 'cc-ing my postdoc who owns that line of work now.', 300, false),
];

export default function DevShots() {
  const step = (new URLSearchParams(window.location.search).get('step') ?? 'people') as ShotStep;
  const [campaign, setCampaign] = useState(() => seeded(step === 'inbox' ? 'people' : step));
  if (step === 'inbox') {
    return (
      <div className="shell">
        <Sidebar
          section="inbox"
          inboxCount={REPLIES.length}
          draftsCount={null}
          profile={{ name: 'Varun', picture: null }}
          theme="default"
          outreachActive={false}
          onNavigate={() => undefined}
          onCompose={() => undefined}
          onToggleTheme={() => undefined}
          onRequestFeature={() => undefined}
          onHome={() => undefined}
          onOutreach={() => undefined}
        />
        <main className="pane">
          <Inbox
            mode="inbox"
            emails={REPLIES}
            selectedId={REPLIES[0].id}
            fadingIds={[]}
            loading={false}
            onOpen={() => undefined}
            onSelect={() => undefined}
            onRefresh={() => undefined}
            onOpenPalette={() => undefined}
            onForceReply={() => undefined}
          />
        </main>
      </div>
    );
  }
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
