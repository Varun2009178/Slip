import { useEffect, useRef, useState } from 'react';
import { filterCommands, type Command } from '../lib/commands';

interface Props {
  commands: Command[];
  onClose: () => void;
}

export default function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = filterCommands(commands, query);
  const active = Math.min(index, Math.max(matches.length - 1, 0));

  function pick(cmd: Command | undefined) {
    if (!cmd) return;
    onClose();
    cmd.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      setIndex(Math.min(active + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      setIndex(Math.max(active - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
    e.stopPropagation();
  }

  useEffect(() => {
    listRef.current
      ?.querySelector('.palette-row.active')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, query]);

  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="palette-input"
          placeholder="Type a command…"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={onKeyDown}
        />
        <div className="palette-list" ref={listRef}>
          {matches.length === 0 && <div className="palette-empty">No matching command</div>}
          {matches.map((cmd, i) => (
            <button
              key={cmd.id}
              className={i === active ? 'palette-row active' : 'palette-row'}
              onMouseEnter={() => setIndex(i)}
              onClick={() => pick(cmd)}
            >
              {cmd.label}
              {cmd.keys && <kbd>{cmd.keys}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
