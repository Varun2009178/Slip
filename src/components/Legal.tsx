interface Props {
  page: 'privacy' | 'tos';
}

function Privacy() {
  return (
    <>
      <h1>Privacy</h1>
      <p>Slip runs entirely in your browser. There is no Slip server and no database.</p>
      <h2>Your email</h2>
      <p>
        Your messages travel directly between your browser and Google's Gmail API. Slip never
        stores, proxies, or analyzes them anywhere else. The Google access token lives only in
        your tab's memory and disappears when you close or reload it.
      </p>
      <h2>What stays on your device</h2>
      <ul>
        <li>Your preferences (theme) in this browser's localStorage.</li>
        <li>The list of emails you've marked done or snoozed, in localStorage.</li>
        <li>
          Your outreach batches — recipient lists, templates, and send/reply status — in
          localStorage, keyed to the Google account you connected. They never leave this browser.
        </li>
      </ul>
      <h2>What we collect</h2>
      <p>Nothing. No analytics, no tracking, no cookies of our own.</p>
      <h2>Google Limited Use</h2>
      <p>
        Slip's use of information received from Google APIs adheres to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
    </>
  );
}

function Tos() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        Slip is a free, keyboard-first client for your own Gmail account, currently in private
        beta.
      </p>
      <ul>
        <li>You use Slip with your own Google account and remain bound by Google's terms.</li>
        <li>
          Slip is provided as-is, without warranty of any kind. It's a beta: things may break,
          change, or pause without notice.
        </li>
        <li>
          Everything Slip does — reading, sending, archiving — happens in your browser under your
          instruction. You are responsible for what you send.
        </li>
        <li>
          To the maximum extent permitted by law, Slip's liability for any claim arising from its
          use is zero dollars — it's a free beta.
        </li>
      </ul>
    </>
  );
}

export default function Legal({ page }: Props) {
  return (
    <div className="legal">
      <a className="legal-back" href="/">
        ← slip
      </a>
      {page === 'privacy' ? <Privacy /> : <Tos />}
      <p className="legal-contact">
        Questions? <a href="mailto:varun@teyra.app">varun@teyra.app</a>
      </p>
    </div>
  );
}
