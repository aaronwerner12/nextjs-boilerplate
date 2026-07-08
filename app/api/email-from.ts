// Central "from" address for all outbound email. Once your domain is
// verified in Resend, set EMAIL_FROM in Vercel (e.g.
// "Event Fund Playbook <updates@eventfundplaybook.com>") — no code change.
export const EMAIL_FROM =
  process.env.EMAIL_FROM || "Event Fund Playbook <onboarding@resend.dev>";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://eventfundplaybook.com";
