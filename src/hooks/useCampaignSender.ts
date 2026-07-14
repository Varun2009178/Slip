import { useEffect, useRef } from 'react';
import { sendEmail } from '../lib/gmail';
import {
  nextSendDelayMs,
  recordFailed,
  recordSent,
  renderedFor,
  requeueRecipient,
  startNextSend,
  type Campaign,
} from '../lib/outreach';

interface Deps {
  campaign: Campaign | null; // the one campaign currently in state 'sending'
  update: (c: Campaign) => void; // persists + updates App state
  onAuthExpired: (paused: Campaign) => void; // show the reconnect affordance
}

// Drives the active campaign while the tab is open: send one, wait 45–120 s,
// repeat. The effect is keyed on (id, state) so per-send updates don't
// restart it; `live` carries the freshest campaign into the async loop.
export function useCampaignSender({ campaign, update, onAuthExpired }: Deps) {
  const live = useRef(campaign);
  live.current = campaign;

  const id = campaign?.state === 'sending' ? campaign.id : null;

  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let timer: number | undefined;

    async function step(): Promise<void> {
      const current = live.current;
      if (stopped || !current || current.id !== id || current.state !== 'sending') return;
      const next = startNextSend(current);
      if (!next) return;
      update(next.campaign);
      live.current = next.campaign;
      const { subject, body } = renderedFor(next.campaign, next.recipient);
      let after: Campaign;
      try {
        const sent = await sendEmail({ to: next.recipient.fields.email, subject, body });
        // Always record a completed send, even if the user paused meanwhile —
        // the email is out; the state must say so.
        after = recordSent(live.current ?? next.campaign, next.recipient.id, sent);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'send failed';
        const base = live.current ?? next.campaign;
        if (msg === 'not-connected') {
          // Token expired: the API refused before sending, so requeue and pause.
          const paused: Campaign = { ...requeueRecipient(base, next.recipient.id), state: 'paused' };
          update(paused);
          live.current = paused;
          onAuthExpired(paused);
          return;
        }
        after = recordFailed(base, next.recipient.id, msg);
      }
      update(after);
      live.current = after;
      if (!stopped && after.state === 'sending') {
        timer = window.setTimeout(step, nextSendDelayMs());
      }
    }

    void step();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
    // update/onAuthExpired are stable enough for this app's inline handlers;
    // re-running on their identity would restart the send loop mid-wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
