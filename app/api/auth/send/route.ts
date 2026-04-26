import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_auth_tokens (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      used BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate a secure random token
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

    // Store token — expires in 15 minutes
    const id = "tok_" + Date.now().toString(36);
    await sql`
      INSERT INTO etf_auth_tokens (id, email, token, expires_at)
      VALUES (
        ${id},
        ${normalizedEmail},
        ${token},
        NOW() + INTERVAL '15 minutes'
      )
    `;

    // Build magic link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const magicLink = `${appUrl}/auth/verify?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send email via Resend
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ETF Analysis Tool <onboarding@resend.dev>",
        to: [normalizedEmail],
        subject: "Your sign-in link — Texas ETF Analysis Tool",
        html: `
          <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #1a1613;">
            <div style="background: #1a1613; padding: 28px 36px; border-radius: 6px 6px 0 0;">
              <div style="font-size: 20px; font-weight: 600; color: #f5f0e8;">Texas Events Trust Fund</div>
              <div style="font-size: 12px; color: #9e9890; margin-top: 4px; text-transform: uppercase; letter-spacing: .1em;">Analysis Tool</div>
            </div>
            <div style="padding: 36px; border: 1px solid #e8e3db; border-top: none; border-radius: 0 0 6px 6px;">
              <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600;">Sign in to ETF Analysis Tool</p>
              <p style="margin: 0 0 28px; font-size: 14px; color: #6b6660; line-height: 1.6;">
                Click the button below to sign in. This link expires in 15 minutes and can only be used once.
              </p>
              <a href="${magicLink}"
                 style="display: inline-block; padding: 14px 32px; background: #1a1613; color: #f5f0e8; text-decoration: none; border-radius: 4px; font-size: 15px; font-weight: 600; letter-spacing: .01em;">
                Sign In →
              </a>
              <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                If you didn't request this, you can ignore this email.<br>
                Link expires at ${new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString("en-US", { timeZone: "America/Chicago" })} CT
              </p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e8e3db; font-size: 11px; color: #9ca3af;">
                Can't click the button? Copy this link:<br>
                <span style="color: #6b6660; word-break: break-all;">${magicLink}</span>
              </div>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error("Resend error:", err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/send error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}