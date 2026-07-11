const FEATURES = [
  {
    img: '/shots/home.png',
    title: 'keyboard first. actually.',
    desc: 'sign in and land on keys, not clutter. i opens the inbox, c composes, e makes email disappear; your hands never leave the keyboard.',
  },
  {
    img: '/shots/palette.png',
    title: '⌘k does anything',
    desc: 'one shortcut, every action. type three letters, hit enter, done.',
  },
  {
    img: '/shots/inbox.png',
    title: 'an inbox with nothing extra',
    desc: 'your 25 newest emails in one flat list. unread glows, starred pins to the top, everything else stays out of your way.',
  },
  {
    img: '/shots/composer.png',
    title: 'write like it matters',
    desc: 'a big, calm composer with real formatting. what you see is exactly what they get. ⌘enter really sends.',
  },
];

// Real screenshots of the product, under the fold of the front page.
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
