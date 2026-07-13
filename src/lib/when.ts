export interface WhenOption {
  label: string;
  when: Date;
}

function at(base: Date, addDays: number, hour: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// Strictly-next occurrence of a weekday, so "This weekend" on a Saturday
// means next Saturday, never a time earlier today.
function nextDow(base: Date, dow: number, hour: number): Date {
  const d = at(base, 0, hour);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== dow);
  return d;
}

export function snoozePresets(now: Date): WhenOption[] {
  return [
    { label: 'later today', when: new Date(now.getTime() + 3 * 3600_000) },
    { label: 'tomorrow', when: at(now, 1, 8) },
    { label: 'this weekend', when: nextDow(now, 6, 8) },
    { label: 'next week', when: nextDow(now, 1, 8) },
  ];
}

export function formatWhen(d: Date): string {
  return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
