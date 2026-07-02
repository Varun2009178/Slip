const KEY = 'tiny-mail-state';

export interface MailState {
  readIds: string[];
  doneIds: string[];
}

const EMPTY: MailState = { readIds: [], doneIds: [] };

export function loadState(): MailState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<MailState>;
    return {
      readIds: Array.isArray(p.readIds) ? p.readIds : [],
      doneIds: Array.isArray(p.doneIds) ? p.doneIds : [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveState(state: MailState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — state simply doesn't persist
  }
}
