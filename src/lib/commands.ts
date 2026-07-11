export interface Command {
  id: string;
  label: string;
  keys?: string; // display-only shortcut hint, e.g. "E"
  run: () => void;
}

// prefix > acronym > word-start > substring > subsequence; ties keep list order.
function score(label: string, q: string): number {
  if (label.startsWith(q)) return 5;
  const initials = label
    .split(/\s+/)
    .map((w) => w[0])
    .join('');
  if (initials.startsWith(q)) return 4;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 3;
  if (label.includes(q)) return 2;
  let i = 0;
  for (const ch of label) {
    if (ch === q[i]) i++;
  }
  return i === q.length ? 1 : 0;
}

export function filterCommands<T extends { label: string }>(commands: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands
    .map((c) => [score(c.label.toLowerCase(), q), c] as const)
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([, c]) => c);
}
