import { createHash, createHmac, randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { EMAIL_FROM } from "../../email-from";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

function hashPasscode(passcode: string): string {
  const secret = process.env.PASSCODE_SECRET || "etf-passcode-secret";
  return createHmac("sha256", secret).update(passcode).digest("hex");
}

// Reset tokens are stored hashed so a database leak can't be used to reset codes
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_passcode_resets (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS etf_login_attempts (
      ip TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : "").trim() || "unknown";
}

// POST /api/orgs/recover { email } — send a reset link to the org's
// notification email. Response is identical whether or not the email
// matches an org, to prevent probing for registered addresses.
export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const { email } = await req.json();
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    // Rate limit recovery requests per IP (reuses the login attempts table
    // with a prefixed key): 3 per 15 minutes
    const ip = "recover:" + clientIp(req);
    const recent = await sql`
      SELECT COUNT(*) as count FROM etf_login_attempts
      WHERE ip = ${ip} AND created_at > NOW() - INTERVAL '15 minutes'
    `;
    if (parseInt(recent[0]?.count || "0") >= 3) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }
    await sql`INSERT INTO etf_login_attempts (ip) VALUES (${ip})`.catch(() => {});

    const genericOk = NextResponse.json({
      ok: true,
      message: "If that email is registered to an organization, a reset link is on its way.",
    });

    const orgs = await sql`
      SELECT id, name, notify_email FROM etf_orgs
      WHERE LOWER(TRIM(notify_email)) = ${cleanEmail}
    `;
    if (orgs.length === 0) return genericOk;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return genericOk; // don't reveal config problems to the caller

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://etfplaybook.vercel.app";

    // One email, one reset link per matching org (usually just one)
    const links: string[] = [];
    for (const org of orgs) {
      const token = randomBytes(32).toString("hex");
      const id = "rst_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await sql`
        INSERT INTO etf_passcode_resets (id, org_id, token_hash, expires_at)
        VALUES (${id}, ${org.id}, ${hashToken(token)}, NOW() + INTERVAL '30 minutes')
      `;
      links.push(
        `<p style="margin:16px 0"><a href="${appUrl}/reset?token=${token}" style="display:inline-block;padding:12px 28px;background:#E0784E;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600">Reset access code for ${org.name}</a></p>`
      );
    }

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [cleanEmail],
        subject: "Reset your Event Fund Playbook access code",
        html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:28px;background:#F1EFE6;border-radius:12px">
  <h2 style="color:#1E4536;margin:0 0 8px">Reset your access code</h2>
  <p style="color:#6C7065;font-size:14px;line-height:1.6">Someone (hopefully you) requested a new team access code. Click below to set one — the link works for 30 minutes and can be used once.</p>
  ${links.join("")}
  <p style="color:#979A8D;font-size:12px;margin-top:20px;line-height:1.6">If you didn't request this, you can ignore this email — your current access code still works. The new code will apply to your whole team.</p>
</div>`,
      }),
    }).catch(() => {});

    return genericOk;
  } catch (error) {
    console.error("POST /api/orgs/recover error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/orgs/recover { token, newPasscode } — consume a reset token
export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const { token, newPasscode } = await req.json();

    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }
    if (!newPasscode || newPasscode.length < 8) {
      return NextResponse.json({ error: "New access code must be at least 8 characters" }, { status: 400 });
    }

    const rows = await sql`
      SELECT r.id, r.org_id, o.name as org_name
      FROM etf_passcode_resets r
      JOIN etf_orgs o ON o.id = r.org_id
      WHERE r.token_hash = ${hashToken(token)}
        AND r.used = FALSE
        AND r.expires_at > NOW()
      LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "This link is invalid or has expired. Request a new one." }, { status: 400 });
    }

    await sql`
      UPDATE etf_orgs SET passcode_hash = ${hashPasscode(newPasscode)}, passcode = NULL
      WHERE id = ${rows[0].org_id}
    `;
    await sql`UPDATE etf_passcode_resets SET used = TRUE WHERE id = ${rows[0].id}`;
    // Clean up stale reset rows while we're here
    await sql`DELETE FROM etf_passcode_resets WHERE expires_at < NOW() - INTERVAL '1 day'`.catch(() => {});

    return NextResponse.json({ ok: true, orgName: rows[0].org_name });
  } catch (error) {
    console.error("PATCH /api/orgs/recover error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
