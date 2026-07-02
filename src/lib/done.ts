const KEY = 'tiny-mail-done';
const CAP = 50;

export function loadDoneIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function save(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, CAP)));
  } catch {
    // storage unavailable — the Read section just won't persist
  }
}

export function addDoneId(id: string): void {
  save([id, ...loadDoneIds().filter((x) => x !== id)]);
}

export function removeDoneId(id: string): void {
  save(loadDoneIds().filter((x) => x !== id));
}
