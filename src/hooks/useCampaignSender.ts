import { useEffect, useRef } from 'react';
import { sendEmail } from '../lib/gmail';
import {
  MIN_GAP_MS,
  nextSendDelayMs,
  recordFailed,
  recordSent,
  renderedFor,
  requeueRecipient,
  startNextSend,
  type Campaign,
} from '../lib/outreach';

interface Deps {
  campaigns: Campaign[]; // all campaigns; the hook finds the sending one
  update: (c: Campaign) => void; // persists + updates App state
  onAuthExpired: (paused: Campaign) => void; // show the reconnect affordance
}

// How soon to re-check when a send from a torn-down effect instance is still
// on the wire (rapid pause→resume, or StrictMode's dev double-mount).
const IN_FLIGHT_POLL_MS = 1_000;

// Drives the sending campaign while the tab is open: send one, wait 45–120 s,
// repeat. The effect is keyed on the sending campaign's id so per-send updates
// don't restart it. `live` always holds the freshest campaigns array, so a
// pause clicked while a send is on the wire is respected — the completion is
// recorded into the *paused* campaign (settle only advances a sending one).
export function useCampaignSender({ campaigns, update, onAuthExpired }: Deps) {
  const live = useRef(campaigns);
  live.current = campaigns;
  // Shared across effect instances: never two sends on the wire, and never
  // less than MIN_GAP_MS between completed sends, even across pause/resume.
  const inFlightRef = useRef(false);
  const lastSentAtRef = useRef(0);

  const id = campaigns.find((c) => c.state === 'sending')?.id ?? null;

  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let timer: number | undefined;

    async function step(): Promise<void> {
      if (stopped) return;
      if (inFlightRef.current) {
        // A previous instance's send is still on the wire; check back.
        timer = window.setTimeout(step, IN_FLIGHT_POLL_MS);
        return;
      }
      const wait = lastSentAtRef.current + MIN_GAP_MS - Date.now();
      if (wait > 0) {
        timer = window.setTimeout(step, wait);
        return;
      }
      const current = live.current.find((c) => c.id === id);
      if (!current || current.state !== 'sending') return;
      const next = startNextSend(current);
      if (!next) {
        // Nothing queued and nothing on the wire: the run is complete.
        if (!current.recipients.some((r) => r.status === 'sending')) {
          update({ ...current, state: 'done' });
        }
        return;
      }
      inFlightRef.current = true;
      update(next.campaign);
      const { subject, body } = renderedFor(next.campaign, next.recipient);
      // Look the campaign up fresh at resolution time — a pause clicked while
      // the send was on the wire must never be overwritten.
      const latest = () => live.current.find((c) => c.id === id) ?? next.campaign;
      let after: Campaign;
      try {
        const sent = await sendEmail({ to: next.recipient.fields.email, subject, body });
        lastSentAtRef.current = Date.now();
        // Always record a completed send, even if the user paused meanwhile —
        // the email is out; the state must say so.
        after = recordSent(latest(), next.recipient.id, sent);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'send failed';
        if (msg === 'not-connected') {
          // Token expired: the API refused before sending — requeue and pause.
          inFlightRef.current = false;
          const paused: Campaign = { ...requeueRecipient(latest(), next.recipient.id), state: 'paused' };
          update(paused);
          onAuthExpired(paused);
          return;
        }
        after = recordFailed(latest(), next.recipient.id, msg);
      }
      inFlightRef.current = false;
      update(after);
      if (!stopped && after.state === 'sending') {
        timer = window.setTimeout(step, nextSendDelayMs());
      }
    }

    void step();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
    // update/onAuthExpired identity churn must not restart the loop mid-wait;
    // the refs carry fresh state across renders instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
