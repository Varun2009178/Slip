import { useEffect, useState } from 'react';
import { formatWhen, type WhenOption } from '../lib/when';

interface Props {
  title: string;
  options: WhenOption[];
  onPick: (when: Date) => void;
  onClose: () => void;
}

export default function WhenPicker({ title, options, onPick, onClose }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      e.stopPropagation(); // keep j/k/e out of the list underneath
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown' || e.key === 'j') setIndex((i) => Math.min(i + 1, options.length - 1));
      else if (e.key === 'ArrowUp' || e.key === 'k') setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === 'Enter') onPick(options[index].when);
      else if (/^[1-9]$/.test(e.key) && options[Number(e.key) - 1]) {
        onPick(options[Number(e.key) - 1].when);
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, options, onPick, onClose]);

  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <div className="when-picker" onMouseDown={(e) => e.stopPropagation()}>
        <div className="when-title">{title}</div>
        {options.map((o, i) => (
          <button
            key={o.label}
            className={i === index ? 'when-option active' : 'when-option'}
            onMouseEnter={() => setIndex(i)}
            onClick={() => onPick(o.when)}
          >
            <span>
              <kbd>{i + 1}</kbd> {o.label}
            </span>
            <span className="when-time">{formatWhen(o.when)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
