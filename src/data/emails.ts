export interface Message {
  id: string;
  from: string;
  body: string;
  date: string; // ISO 8601
}

export interface Email {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  date: string; // ISO 8601
  important: boolean;
  thread: Message[]; // earlier messages, oldest first
}

export const emails: Email[] = [
  {
    id: 'e1',
    from: 'Priya Raman',
    fromEmail: 'priya@lattice.dev',
    subject: 'Q3 roadmap review — Thursday?',
    body: 'Can we move the roadmap review to Thursday at 2pm? Sofia is out Wednesday and I want her in the room for the infra discussion.\n\nIf Thursday works, I will send the updated invite tonight.',
    date: '2026-07-01T09:12:00',
    important: true,
    thread: [],
  },
  {
    id: 'e2',
    from: 'Dana Whitfield',
    fromEmail: 'dana.whitfield@northbeam.io',
    subject: 'Re: Contract renewal terms',
    body: 'Legal signed off on the revised terms. The only remaining change is the 60-day notice period we discussed — see section 4.2.\n\nIf that looks right to you, we can countersign this week.',
    date: '2026-07-01T08:47:00',
    important: true,
    thread: [
      {
        id: 'e2-t1',
        from: 'You',
        body: 'Thanks Dana — we would want the notice period at 60 days rather than 30. Everything else in the draft looks fine.',
        date: '2026-06-29T16:20:00',
      },
      {
        id: 'e2-t2',
        from: 'Dana Whitfield',
        body: 'Understood, let me run the 60-day notice period by legal and get back to you.',
        date: '2026-06-30T10:05:00',
      },
    ],
  },
  {
    id: 'e3',
    from: 'Marcus Oyelaran',
    fromEmail: 'marcus@figstack.com',
    subject: 'Design crit notes from yesterday',
    body: 'Notes from the crit:\n\nThe empty state needs work — three people flagged it as confusing. The settings reorg landed well. Nav icons are still split, I say we ship the text-only version and revisit.\n\nFull notes in the doc, but that is the gist.',
    date: '2026-06-30T17:31:00',
    important: false,
    thread: [],
  },
  {
    id: 'e4',
    from: 'Elena Vasquez',
    fromEmail: 'elena.v@corticalsystems.com',
    subject: 'Intro: Sam from Meridian Capital',
    body: 'You two should know each other. Sam leads developer tools investments at Meridian and has been following your space closely.\n\nSam — meet one of the sharpest builders I know. I will let you two take it from here.',
    date: '2026-06-30T14:02:00',
    important: false,
    thread: [],
  },
  {
    id: 'e5',
    from: 'GitHub',
    fromEmail: 'noreply@github.com',
    subject: '[lattice/core] Release v2.14.0 published',
    body: 'Release v2.14.0 has been published.\n\nHighlights: new streaming API, 40% faster cold starts, and the deprecation of the legacy webhook format announced in v2.10.',
    date: '2026-06-30T11:15:00',
    important: false,
    thread: [],
  },
  {
    id: 'e6',
    from: 'Tomás Herrera',
    fromEmail: 'tomas@lattice.dev',
    subject: 'Re: Postgres migration window',
    body: 'Confirmed with the SRE team — we have a window Saturday 02:00–04:00 UTC. Read replicas stay up the whole time, primary fails over once, expected write downtime under 90 seconds.\n\nI will run the rehearsal Friday and send the checklist after.',
    date: '2026-06-29T19:44:00',
    important: false,
    thread: [
      {
        id: 'e6-t1',
        from: 'You',
        body: 'What is the realistic downtime estimate for the primary? If it is more than a few minutes we should schedule a maintenance banner.',
        date: '2026-06-29T09:10:00',
      },
    ],
  },
  {
    id: 'e7',
    from: 'Aiko Tanaka',
    fromEmail: 'aiko@pressroom.jp',
    subject: 'Interview request — developer tools piece',
    body: 'I am writing a piece on the new wave of developer productivity tools for Pressroom and would love 20 minutes of your time next week.\n\nHappy to work around your schedule — mornings JST tend to be best on my end.',
    date: '2026-06-28T22:08:00',
    important: false,
    thread: [],
  },
  {
    id: 'e8',
    from: 'Stripe',
    fromEmail: 'receipts@stripe.com',
    subject: 'Your June invoice is available',
    body: 'Your invoice for June 2026 is now available.\n\nTotal: $1,284.00. Payment will be collected automatically from the card on file on July 5.',
    date: '2026-06-28T07:00:00',
    important: false,
    thread: [],
  },
  {
    id: 'e9',
    from: 'Noor Haddad',
    fromEmail: 'noor@openatlas.org',
    subject: 'Speaking at Atlas Conf in October?',
    body: 'We are putting together the speaker lineup for Atlas Conf (Oct 14–15, Lisbon) and your name came up immediately for the infrastructure track.\n\n30-minute talk, topic of your choosing. Travel and accommodation covered. Interested?',
    date: '2026-06-27T13:26:00',
    important: false,
    thread: [],
  },
];
