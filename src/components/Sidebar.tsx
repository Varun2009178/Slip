import type { Section } from './Inbox';
import type { Profile } from '../lib/gmail';
import {
  IconCheck,
  IconClock,
  IconCompose,
  IconDraft,
  IconGitHub,
  IconInbox,
  IconSent,
  SlipMark,
} from './icons';

interface Props {
  section: Section;
  inboxCount: number;
  draftsCount: number | null;
  profile: Profile | null;
  theme: 'default' | 'paper';
  start: 'keys' | 'inbox';
  onNavigate: (section: Section) => void;
  onCompose: () => void;
  onToggleTheme: () => void;
  onToggleStart: () => void;
  onRequestFeature: () => void;
  onHome: () => void;
}

const ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'inbox', label: 'Inbox', icon: <IconInbox /> },
  { key: 'read', label: 'Read', icon: <IconCheck /> },
  { key: 'snoozed', label: 'Snoozed', icon: <IconClock /> },
  { key: 'sent', label: 'Sent', icon: <IconSent /> },
  { key: 'drafts', label: 'Drafts', icon: <IconDraft /> },
];

export default function Sidebar({
  section,
  inboxCount,
  draftsCount,
  profile,
  theme,
  start,
  onNavigate,
  onCompose,
  onToggleTheme,
  onToggleStart,
  onRequestFeature,
  onHome,
}: Props) {
  const counts: Partial<Record<Section, number | null>> = {
    inbox: inboxCount,
    drafts: draftsCount,
  };

  return (
    <nav className="sidebar">
      <div className="side-brand">
        <button className="brand-home" title="Home" onClick={onHome}>
          <SlipMark />
          <span className="brand-name">{profile?.name ? `${profile.name}’s Mail` : 'Slip Mail'}</span>
        </button>
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
        <a
          className="nav-item"
          href="https://github.com/Varun2009178/Slip"
          target="_blank"
          rel="noreferrer"
          title="Slip on GitHub"
        >
          <IconGitHub />
          GitHub
        </a>
        <button className="nav-item" onClick={onRequestFeature} title="Emails your idea straight to the maker">
          <span className="theme-dot">✦</span>
          Request a feature
        </button>
        <button
          className="nav-item"
          onClick={onToggleStart}
          title="What you land on right after connecting"
        >
          <span className="theme-dot">{start === 'keys' ? '⌘' : '✉'}</span>
          Start: {start === 'keys' ? 'keys' : 'inbox'}
        </button>
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
