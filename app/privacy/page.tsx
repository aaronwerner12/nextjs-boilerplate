// @ts-nocheck
"use client";

const SERIF = "'Fraunces', 'Georgia', serif";

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F7F5EF", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E4536" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, marginBottom: 8 }}>Privacy Policy</div>
          <div style={{ fontSize: 13, color: "#979A8D" }}>Texas Events Trust Fund Analysis Tool · Last updated July 2026</div>
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#F1EFE6", borderRadius: 10, fontSize: 13, color: "#6C7065", lineHeight: 1.6 }}>
            This Tool is independently operated and is not affiliated with any DMO, CVB, municipality, or government entity, including the State of Texas or the Office of the Governor.
          </div>
        </div>

        {[
          {
            title: "1. What We Collect",
            body: `When you use this Tool, we collect:

• Your name and (optionally) your job title, entered at sign-in
• Your work email address, if you provide it, so we can send you deadline reminders and pipeline updates
• Your organization's name, city, mailing address, contact details (name, title, phone, email), and federal Tax ID (EIN) — the fields needed to prepare an ETF application, entered by your team in Organization Settings
• Event analysis data you enter (event names, dates, venues, attendance estimates, financial projections, documents, notes, and award/disbursement outcomes)
• Intake form submissions from event organizers, including their contact information
• Activity and usage data: a per-event change log (who edited which fields and when), which teammates currently have an event open, and IP addresses of sign-in attempts (used only to rate-limit and block password guessing)
• Basic diagnostic data when the app encounters an error (error message, page, and browser type)

We do not collect payment card information or Social Security numbers.`
          },
          {
            title: "2. How We Use Your Data",
            body: `We use your data to:

• Provide the Tool's functionality (storing and displaying your event analyses and application data)
• Send email notifications when intake form submissions are received, at the notification address your organization configured
• Send a weekly deadline digest and a monthly pipeline check-in to the organization's notification/contact addresses and to team members who have added a work email
• Protect your account by rate-limiting repeated failed sign-in attempts
• Diagnose and fix errors, and generate aggregate, anonymous usage statistics for tool improvement

We do not sell your data or use it for third-party advertising.

Email preferences: the weekly and monthly emails are operational updates about your own pipeline. To stop receiving them, remove the email address from Organization Settings (or ask your team admin to remove a member's address), or contact the tool administrator and we will unsubscribe you.`
          },
          {
            title: "3. How Your Data Is Stored",
            body: `Your data is stored in a Postgres database hosted by Neon (neon.tech) on AWS infrastructure in the United States.

Access codes are never stored in plain text in our database — they are stored as a salted cryptographic hash, so the actual code cannot be read even by us. For convenience, your browser also remembers your access code locally so you don't have to re-enter it; you can clear this by signing out. We recommend choosing a strong, unique access code for your organization.

Some data is also cached in your browser's localStorage to improve performance. This data stays on your device except when syncing with our database.`
          },
          {
            title: "4. Who Can See Your Data",
            body: `Your event pipeline data is visible only to:

• Members of your organization who sign in with your access code
• Anyone you deliberately share a read-only event link with (these links show a limited summary — no internal notes or award figures — and can be regenerated)
• The tool administrator (aggregate stats only — no event names or financial details)

No other organizations, DMOs, CVBs, municipalities, or government entities can see your event data. We do not share your data with EDT, the State of Texas, or any DMO that may have referred you.`
          },
          {
            title: "5. Intake Form Submissions",
            body: `When an event organizer submits your intake form at /intake, their submission is stored in our database and a notification is sent to your organization's configured email address. Intake submissions include the organizer's contact information and event details, and are visible to your team and the tool administrator.`
          },
          {
            title: "6. Error and Feedback Reports",
            body: `If you use the in-app "Report an issue" button, your message is stored and — so we can act on it — may be filed as an issue in our private code repository hosted by GitHub. If the app crashes, a diagnostic report (the error, the page, your browser type, and your name and organization) may be filed the same way so we can fix it. These reports are used only to maintain and improve the Tool. Please don't include sensitive information in feedback messages.`
          },
          {
            title: "7. Data Retention",
            body: `We retain your data for as long as your organization is actively using the Tool. Deleted events are held in a recoverable trash for 30 days and then permanently removed. Sign-in attempt logs are kept briefly for security and then purged. If you would like your organization's data deleted, contact the tool administrator and we will remove it within 30 days.`
          },
          {
            title: "8. Cookies and Local Storage",
            body: `This Tool uses browser localStorage (not traditional cookies) to remember your sign-in state, your name and email, and to cache your event data locally. This data is stored only on your device and is cleared when you sign out or clear your browser data. We do not use third-party advertising or tracking cookies beyond basic Vercel platform analytics.`
          },
          {
            title: "9. Third-Party Services",
            body: `This Tool uses the following third-party services, each with its own privacy policy:

• Neon (neon.tech) — database hosting
• Vercel (vercel.com) — application hosting, deployment, and basic analytics
• Resend (resend.com) — email delivery
• GitHub (github.com) — hosts our code repository, where feedback and crash reports are filed

We have configured these services to minimize data retention and sharing.`
          },
          {
            title: "10. Your Rights",
            body: `You have the right to:

• Access the data your organization has stored in the Tool
• Request correction of inaccurate data
• Request deletion of your organization's data or your personal information
• Export your event data (the dashboard includes a pipeline CSV export, or contact the administrator)
• Opt out of the weekly and monthly emails at any time

To exercise these rights, contact the tool administrator.`
          },
          {
            title: "11. Changes to This Policy",
            body: `We may update this Privacy Policy from time to time. We will update the "Last updated" date when changes are made. Continued use of the Tool after changes are posted constitutes acceptance of the updated Policy.`
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{section.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: "#3D4B43", whiteSpace: "pre-line" }}>{section.body}</div>
          </div>
        ))}

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #DFDDD0", display: "flex", gap: 20 }}>
          <a href="/terms" style={{ fontSize: 13, color: "#6C7065" }}>Terms of Service</a>
          <a href="/" style={{ fontSize: 13, color: "#6C7065" }}>Back to Tool</a>
        </div>
      </div>
    </div>
  );
}
