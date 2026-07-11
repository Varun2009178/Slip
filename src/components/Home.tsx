import type { Section } from './Inbox';

interface Props {
  onNavigate: (section: Section) => void;
  onCompose: () => void;
  onOpenPalette: () => void;
  onRequestFeature: () => void;
}

// The keyboard-first landing screen: no mail, just the keys that take you places.
export default function Home({ onNavigate, onCompose, onOpenPalette, onRequestFeature }: Props) {
  const cards = [
    { k: 'I', label: 'Inbox', run: () => onNavigate('inbox') },
    { k: 'C', label: 'Compose', run: onCompose },
    { k: 'D', label: 'Drafts', run: () => onNavigate('drafts') },
    { k: 'R', label: 'Read', run: () => onNavigate('read') },
    { k: 'F', label: 'Request a feature', run: onRequestFeature },
    { k: '⌘K', label: 'Anything', run: onOpenPalette },
  ];
  return (
    <div className="home">
      <div className="home-inner">
        <p className="home-hint">Press a key.</p>
        <div className="home-grid">
          {cards.map((c) => (
            <button key={c.k} className="home-card" onClick={c.run}>
              <kbd className="home-key">{c.k}</kbd>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
