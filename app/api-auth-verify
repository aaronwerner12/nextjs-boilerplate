import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

// Domain → org ID mapping for auto-assignment
// The org ID is generated during setup as: name_lowercased + timestamp
// Update this once you've completed org setup and know your actual org ID
// Check localStorage key "etf_org_id" in your browser after first setup
const DOMAIN_ORG_MAP: Record<string, string> = {
  "visitmckinney.com": "", // ← paste your org ID here after first setup
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email")?.toLowerCase().trim();

    if (!token || !email) {
      return NextResponse.redirect(new URL("/auth?error=invalid", req.url));
    }

    // Look up token
    const rows = await sql`
      SELECT * FROM etf_auth_tokens
      WHERE token = ${token}
        AND email = ${email}
        AND used = FALSE
        AND expires_at > NOW()
    `;

    if (rows.length === 0) {
      return NextResponse.redirect(new URL("/auth?error=expired", req.url));
    }

    // Mark token as used
    await sql`UPDATE etf_auth_tokens SET used = TRUE WHERE token = ${token}`;

    // Determine org from email domain
    const domain = email.split("@")[1];
    const orgId = DOMAIN_ORG_MAP[domain] || null;

    // Upsert user record
    const userId = "usr_" + email.replace(/[^a-z0-9]/g, "_");
    await sql`
      CREATE TABLE IF NOT EXISTS etf_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        org_id TEXT,
        name TEXT,
        last_login TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO etf_users (id, email, org_id, last_login)
      VALUES (${userId}, ${email}, ${orgId}, NOW())
      ON CONFLICT (email) DO UPDATE
        SET last_login = NOW(),
            org_id = COALESCE(etf_users.org_id, ${orgId})
    `;

    // Get user's org_id (may have been set previously)
    const userRows = await sql`SELECT * FROM etf_users WHERE email = ${email}`;
    const user = userRows[0];

    // Build session token (simple — stored in localStorage)
    const sessionToken = Array.from(
      crypto.getRandomValues(new Uint8Array(24))
    ).map(b => b.toString(16).padStart(2, "0")).join("");

    // Redirect to app with session info in URL fragment (never hits server)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const params = new URLSearchParams({
      session: sessionToken,
      email,
      userId: user.id,
      orgId: user.org_id || "",
    });

    return NextResponse.redirect(`${appUrl}/?auth=${params.toString()}`);
  } catch (error) {
    console.error("GET /api/auth/verify error:", error);
    return NextResponse.redirect(new URL("/auth?error=server", req.url));
  }
}
