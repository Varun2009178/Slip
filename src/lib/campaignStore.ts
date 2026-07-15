// Campaigns in localStorage, written after every mutation (including after
// every individual send) so a refresh or crash never loses progress.

import type { Campaign } from './outreach';

// Batches belong to a Google account, not to the browser: the storage key is
// scoped by the connected address so switching accounts switches batches.
const LEGACY_KEY = 'slip-campaigns';
let KEY = LEGACY_KEY;

export function setCampaignAccount(email: string | null): void {
  KEY = email ? `slip-campaigns:${email.trim().toLowerCase()}` : LEGACY_KEY;
}

// A campaign loaded while still 'sending' means the tab died mid-run. It
// comes back paused. A recipient stuck at 'sending' is ambiguous — the send
// may or may not have gone out — so it's marked failed with a message telling
// the user to check Gmail's Sent before retrying, rather than risking a
// silent duplicate email.
function normalize(list: Campaign[]): Campaign[] {
  return list.map((c) =>
    c.state !== 'sending'
      ? c
      : {
          ...c,
          state: 'paused',
          recipients: c.recipients.map((r) =>
            r.status === 'sending'
              ? { ...r, status: 'failed', error: 'interrupted — check sent in gmail before retrying' }
              : r,
          ),
        },
  );
}

// One malformed entry mustn't take down the whole store — dropping just the
// bad entry keeps every good campaign, where a throw-and-return-[] would let
// the next save wipe them all.
function isCampaign(c: unknown): c is Campaign {
  return (
    typeof c === 'object' &&
    c !== null &&
    typeof (c as Campaign).id === 'string' &&
    Array.isArray((c as Campaign).recipients)
  );
}

export function loadCampaigns(): Campaign[] {
  try {
    let raw = localStorage.getItem(KEY);
    // One-time migration: batches saved before account scoping live under the
    // legacy key and belong to whichever account connects first.
    if (raw === null && KEY !== LEGACY_KEY) {
      raw = localStorage.getItem(LEGACY_KEY);
      if (raw !== null) {
        localStorage.setItem(KEY, raw);
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const kept = parsed.filter(isCampaign);
    const list = normalize(kept);
    // Write-through when normalization or dropping changed anything, so
    // on-disk state never stays 'sending' (or keeps junk entries).
    if (kept.length !== parsed.length || list.some((c, i) => c !== kept[i])) {
      saveCampaigns(list);
    }
    return list;
  } catch {
    return [];
  }
}

// False when storage is blocked/full — the app keeps working in memory and
// warns that the batch won't survive a refresh.
export function saveCampaigns(list: Campaign[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function upsertCampaign(list: Campaign[], c: Campaign): Campaign[] {
  return list.some((x) => x.id === c.id)
    ? list.map((x) => (x.id === c.id ? c : x))
    : [c, ...list];
}

export function removeCampaign(list: Campaign[], id: string): Campaign[] {
  return list.filter((c) => c.id !== id);
}
