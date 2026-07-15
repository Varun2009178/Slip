import { MeadowStrip } from './FrontScene';

const ITEMS: { title: string; desc: string; status: 'soon' | 'planned' }[] = [
  {
    title: 'follow up nudges',
    desc: 'no reply in 3 days? slip taps you on the shoulder so nothing leaks.',
    status: 'soon',
  },
  {
    title: 'schedule the batch',
    desc: 'build tonight, start sending at 8am sharp while you sleep in.',
    status: 'soon',
  },
  {
    title: 'csv upload',
    desc: 'drop a file instead of pasting, for the spreadsheet-averse.',
    status: 'planned',
  },
  {
    title: 'snooze',
    desc: '"not now, come back tuesday." replies leave the inbox and return when you want them.',
    status: 'planned',
  },
];

// The under-the-fold half of the front page: what's coming, and the legal links.
export default function Roadmap() {
  return (
    <section className="roadmap" id="roadmap">
      <h2>what&rsquo;s coming</h2>
      <p className="roadmap-note">slip is in private beta. 100 seats, outreach first from day one.</p>
      <ol className="roadmap-list">
        {ITEMS.map((item) => (
          <li key={item.title} className="roadmap-item">
            <div className="roadmap-title">
              {item.title}
              <span className={`chip ${item.status}`}>{item.status}</span>
            </div>
            <p className="roadmap-desc">{item.desc}</p>
          </li>
        ))}
      </ol>
      <MeadowStrip />
      <footer className="front-foot">
        <a href="/privacy">privacy</a>
        <span>·</span>
        <a href="/tos">terms</a>
      </footer>
    </section>
  );
}
