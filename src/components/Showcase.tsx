const FEATURES = [
  {
    img: '/shots/outreach-people.png',
    title: 'paste your list. that’s the whole import.',
    desc: 'straight from google sheets — names, emails, one hook per person. every column becomes a {{variable}} you can use in the email.',
  },
  {
    img: '/shots/outreach-write.png',
    title: 'one template. every email personal.',
    desc: 'write it once with {{name}} and {{paper}}. a typo’d variable gets caught before anything can send.',
  },
  {
    img: '/shots/outreach-preview.png',
    title: 'preview every single one.',
    desc: 'read each email exactly as it will land. hand-edit any one of them without touching the rest.',
  },
  {
    img: '/shots/outreach-send.png',
    title: 'sends drip out. replies light up.',
    desc: 'one every 1–2 minutes so it never looks like a blast. when someone replies, the row flips — open it and answer without leaving slip.',
  },
  {
    img: '/shots/outreach-inbox.png',
    title: 'a tiny inbox for the replies.',
    desc: 'the minimal mail client is still here, one fold away. read the reply, hit r, keep the thread moving — your hands never leave the keyboard.',
  },
];

// Real screenshots of the outreach flow, under the fold of the front page.
export default function Showcase() {
  return (
    <section className="showcase" id="tour">
      {FEATURES.map((f) => (
        <figure className="feature" key={f.title}>
          <figcaption>
            <h2>{f.title}</h2>
            <p>{f.desc}</p>
          </figcaption>
          <img src={f.img} alt={f.title} loading="lazy" />
        </figure>
      ))}
    </section>
  );
}
