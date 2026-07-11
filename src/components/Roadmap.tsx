const ITEMS: { title: string; desc: string; status: 'soon' | 'planned' }[] = [
  {
    title: 'snooze',
    desc: '"not now, come back tuesday." emails leave the inbox and return exactly when you want them.',
    status: 'soon',
  },
  {
    title: 'send later',
    desc: 'write at 11pm, land in their inbox at 8am sharp.',
    status: 'soon',
  },
  {
    title: 'follow up nudges',
    desc: 'no reply in 3 days? slip taps you on the shoulder so nothing leaks.',
    status: 'soon',
  },
  {
    title: 'automated replies',
    desc: 'slip drafts the response; you read it and press one key.',
    status: 'planned',
  },
  {
    title: 'priority triage',
    desc: 'investors, customers, and real people float above the noise.',
    status: 'planned',
  },
];

// The under-the-fold half of the front page: what's coming, and the legal links.
export default function Roadmap() {
  return (
    <section className="roadmap" id="roadmap">
      <h2>what&rsquo;s coming</h2>
      <p className="roadmap-note">slip is in private beta. 100 seats, keyboard first from day one.</p>
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
      <footer className="front-foot">
        <a href="/privacy">privacy</a>
        <span>·</span>
        <a href="/tos">terms</a>
      </footer>
    </section>
  );
}
