import type { Section } from './Inbox';

interface Props {
  onNavigate: (section: Section) => void;
  onCompose: () => void;
  onOpenPalette: () => void;
  onRequestFeature: () => void;
  onForceReply: () => void;
}

// The keyboard-first landing screen: no mail, just the keys that take you places.
export default function Home({ onNavigate, onCompose, onOpenPalette, onRequestFeature, onForceReply }: Props) {
  const cards = [
    { k: 'I', label: 'inbox', run: () => onNavigate('inbox') },
    { k: 'C', label: 'compose', run: onCompose },
    { k: 'D', label: 'drafts', run: () => onNavigate('drafts') },
    { k: 'R', label: 'read', run: () => onNavigate('read') },
    { k: 'S', label: 'sent', run: () => onNavigate('sent') },
    { k: 'Z', label: 'force reply', run: onForceReply },
    { k: 'F', label: 'request a feature', run: onRequestFeature },
    { k: '⌘K', label: 'anything', run: onOpenPalette },
  ];
  return (
    <div className="home">
      <div className="home-inner">
        <p className="home-hint">press a key.</p>
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
