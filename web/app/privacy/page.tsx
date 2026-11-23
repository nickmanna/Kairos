export const metadata = { title: "Kairos · Privacy" };

export default function Privacy() {
  return (
    <main className="shell" style={{ paddingBottom: 40 }}>
      <article className="glass" style={{ padding: "20px 22px", lineHeight: 1.6 }}>
        <h1 style={{ marginTop: 0 }}>Privacy</h1>
        <p>
          Kairos is a personal task tool used by its owner only. It is not offered to the public and has no
          accounts for anyone else.
        </p>
        <h2>Google Calendar data</h2>
        <p>
          With your permission, Kairos reads events from your Google calendars to list them, and creates, updates
          and deletes events in a calendar named “Kairos Tasks”. Calendar data is fetched when you open the app and
          is not stored, sold, shared or used for advertising. The only thing kept is the Google authorization
          token, stored encrypted in Google Cloud Secret Manager. You can revoke access at any time at{" "}
          <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
        </p>
        <h2>Task text</h2>
        <p>
          When you add a task, the text you type or dictate is sent to Anthropic’s Claude API to turn it into a title,
          date and time. Anthropic processes it under its commercial terms which by default do not allow it to be used for model training.
        </p>
        <h2>Contact</h2>
        <p>Questions: contact the app owner through the support email shown on the Google consent screen.</p>
      </article>
    </main>
  );
}
