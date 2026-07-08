// Central "from" address for all outbound email. Once your domain is
// verified in Resend, set EMAIL_FROM in Vercel (e.g.
// "Event Fund Playbook <updates@eventfundplaybook.com>") — no code change.
export const EMAIL_FROM =
  process.env.EMAIL_FROM || "Event Fund Playbook <onboarding@resend.dev>";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://eventfundplaybook.com";

// Optional reply-to address. Set EMAIL_REPLY_TO in Vercel to route
// replies somewhere real (e.g. a monitored inbox) without exposing it in
// the from line. Empty = replies go to the from address.
export const REPLY_TO = process.env.EMAIL_REPLY_TO || "";
