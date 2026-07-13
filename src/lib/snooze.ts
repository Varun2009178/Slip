// Local snooze: archive now, wake back into the inbox on the next app open
// past the chosen time. Message id -> wake time (epoch ms), in localStorage.

const KEY = 'tiny-mail-snoozes';

export type SnoozeMap = Record<string, number>;

export function loadSnoozes(): SnoozeMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function save(map: SnoozeMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // snooze just won't survive a reload
  }
}

export function addSnooze(id: string, wakeAt: number): void {
  save({ ...loadSnoozes(), [id]: wakeAt });
}

export function removeSnooze(id: string): void {
  const map = loadSnoozes();
  delete map[id];
  save(map);
}

export function dueSnoozeIds(now = Date.now()): string[] {
  return Object.entries(loadSnoozes())
    .filter(([, wakeAt]) => wakeAt <= now)
    .map(([id]) => id);
}

export function pendingSnoozeIds(now = Date.now()): string[] {
  return Object.entries(loadSnoozes())
    .filter(([, wakeAt]) => wakeAt > now)
    .map(([id]) => id);
}
