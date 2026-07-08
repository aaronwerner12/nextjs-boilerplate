import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { unsubToken, ensureOptOutTable } from "../unsubscribe-lib";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

function page(title: string, message: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:'Inter',system-ui,sans-serif;background:#F7F5EF;color:#1E4536;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
  <div style="max-width:440px;text-align:center">
    <div style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin-bottom:10px">${title}</div>
    <div style="font-size:14px;color:#6C7065;line-height:1.6">${message}</div>
  </div>
</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

// GET /api/unsubscribe?e=<email>&t=<token> — one-click opt-out from the
// weekly digest and monthly check-in emails.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("e") || "").trim().toLowerCase();
  const token = searchParams.get("t") || "";

  if (!email || !email.includes("@") || token !== unsubToken(email)) {
    return page("Link not valid", "This unsubscribe link is invalid or incomplete. If you keep getting emails, reply to one and we'll remove you.");
  }

  try {
    await ensureOptOutTable();
    await sql`
      INSERT INTO etf_email_optout (email) VALUES (${email})
      ON CONFLICT (email) DO NOTHING
    `;
  } catch (_) {
    return page("Something went wrong", "We couldn't process that just now. Please try again in a moment.");
  }

  return page(
    "You're unsubscribed",
    `<strong>${email}</strong> will no longer receive deadline digests or monthly check-ins. Your event data and account are unchanged. Signed in to the tool, you can re-enable emails anytime in Organization Settings.`
  );
}

// POST — supports the RFC 8058 one-click unsubscribe header some mail
// clients use (List-Unsubscribe-Post)
export async function POST(req: NextRequest) {
  return GET(req);
}
