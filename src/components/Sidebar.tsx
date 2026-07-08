import type { Section } from './Inbox';
import type { Profile } from '../lib/gmail';
import { IconCheck, IconCompose, IconDraft, IconInbox, SlipMark } from './icons';

interface Props {
  section: Section;
  inboxCount: number;
  draftsCount: number | null;
  profile: Profile | null;
  theme: 'default' | 'paper';
  onNavigate: (section: Section) => void;
  onCompose: () => void;
  onToggleTheme: () => void;
}

const ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'inbox', label: 'Inbox', icon: <IconInbox /> },
  { key: 'read', label: 'Read', icon: <IconCheck /> },
  { key: 'drafts', label: 'Drafts', icon: <IconDraft /> },
];

export default function Sidebar({
  section,
  inboxCount,
  draftsCount,
  profile,
  theme,
  onNavigate,
  onCompose,
  onToggleTheme,
}: Props) {
  const counts: Partial<Record<Section, number | null>> = {
    inbox: inboxCount,
    drafts: draftsCount,
  };

  return (
    <nav className="sidebar">
      <div className="side-brand">
        <SlipMark />
        <span className="brand-name">{profile?.name ? `${profile.name}’s Mail` : 'Slip Mail'}</span>
        <button className="icon-btn" title="Compose (C)" onClick={onCompose}>
          <IconCompose />
        </button>
      </div>

      <div className="side-label">Mail</div>
      {ITEMS.map(({ key, label, icon }) => {
        const count = counts[key];
        return (
          <button
            key={key}
            className={key === section ? 'nav-item active' : 'nav-item'}
            onClick={() => onNavigate(key)}
          >
            {icon}
            {label}
            {typeof count === 'number' && count > 0 && <span className="nav-count">{count}</span>}
          </button>
        );
      })}

      <div className="side-foot">
        <button
          className="nav-item"
          onClick={onToggleTheme}
          title={theme === 'paper' ? 'Switch to plain theme' : 'Switch to paper theme'}
        >
          <span className="theme-dot">{theme === 'paper' ? '○' : '●'}</span>
          Theme
        </button>
      </div>
    </nav>
  );
}
