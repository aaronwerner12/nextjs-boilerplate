// @ts-nocheck
"use client";

const SERIF = "'Fraunces', 'Georgia', serif";

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'Inter', system-ui, sans-serif", color: "#1a1613" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, marginBottom: 8 }}>Privacy Policy</div>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Texas Events Trust Fund Analysis Tool · Last updated April 2026</div>
        </div>

        {[
          {
            title: "1. What We Collect",
            body: `When you use this Tool, we collect:

• Your name (entered at sign-in)
• Your organization name and city
• Event analysis data you enter (event names, dates, attendance estimates, financial projections)
• Intake form submissions from event organizers
• Basic usage data (which pages are accessed, when)

We do not collect payment information, Social Security numbers, or personally identifiable information beyond your name and organization.`
          },
          {
            title: "2. How We Use Your Data",
            body: `We use your data solely to:

• Provide the Tool's functionality (storing and displaying your event analyses)
• Send email notifications when intake form submissions are received (if you configured a notification email)
• Generate aggregate, anonymous usage statistics for tool improvement

We do not use your data for advertising, marketing, or any purpose unrelated to the Tool's core function.`
          },
          {
            title: "3. How Your Data Is Stored",
            body: `Your data is stored in a Postgres database hosted by Neon (neon.tech) on AWS infrastructure in the United States. Access codes are stored in the database and locally in your browser's localStorage. We recommend choosing a strong, unique access code for your organization.

Some data is also stored in your browser's localStorage to improve performance and reduce load times. This data never leaves your device except when syncing with our database.`
          },
          {
            title: "4. Who Can See Your Data",
            body: `Your event pipeline data is visible to:

• Members of your organization who sign in with your access code
• The tool administrator (aggregate stats only — no event names or financial details)

No other organizations can see your event data. We do not share your data with EDT, the State of Texas, or any third party.`
          },
          {
            title: "5. Intake Form Submissions",
            body: `When an event organizer submits your intake form at /intake, their submission is stored in our database and a notification is sent to your organization's configured email address. Intake submissions include the organizer's contact information and event details. This information is visible to your team and the tool administrator.`
          },
          {
            title: "6. Data Retention",
            body: `We retain your data for as long as your organization is actively using the Tool. If you would like your organization's data deleted, contact the tool administrator and we will remove it within 30 days.`
          },
          {
            title: "7. Cookies and Local Storage",
            body: `This Tool uses browser localStorage (not traditional cookies) to remember your sign-in state and cache your event data locally. This data is stored only on your device and is cleared when you sign out or manually clear your browser data. We do not use third-party tracking cookies or analytics beyond basic Vercel platform analytics.`
          },
          {
            title: "8. Third-Party Services",
            body: `This Tool uses the following third-party services:

• Neon (neon.tech) — database hosting
• Vercel (vercel.com) — application hosting and deployment
• Resend (resend.com) — email delivery for notifications

Each service has its own privacy policy. We have configured these services to minimize data retention and sharing.`
          },
          {
            title: "9. Your Rights",
            body: `You have the right to:

• Access the data your organization has stored in the Tool
• Request correction of inaccurate data
• Request deletion of your organization's data
• Export your event data (contact the administrator)

To exercise these rights, contact the tool administrator.`
          },
          {
            title: "10. Changes to This Policy",
            body: `We may update this Privacy Policy from time to time. We will update the "Last updated" date when changes are made. Continued use of the Tool after changes are posted constitutes acceptance of the updated Policy.`
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{section.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", whiteSpace: "pre-line" }}>{section.body}</div>
          </div>
        ))}

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e8e3db", display: "flex", gap: 20 }}>
          <a href="/terms" style={{ fontSize: 13, color: "#6b6660" }}>Terms of Service</a>
          <a href="/" style={{ fontSize: 13, color: "#6b6660" }}>Back to Tool</a>
        </div>
      </div>
    </div>
  );
}
