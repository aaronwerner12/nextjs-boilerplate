import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_team_members (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      is_admin BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE etf_team_members ADD COLUMN IF NOT EXISTS title TEXT`.catch(() => {});
}

// GET /api/team?org_id=xxx — list all members for an org
export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id");
    if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

    const members = await sql`
      SELECT id, name, title, is_admin, is_active, created_at, last_seen
      FROM etf_team_members
      WHERE org_id = ${orgId}
      ORDER BY is_admin DESC, created_at ASC
    `;
    return NextResponse.json(members);
  } catch (error) {
    console.error("GET /api/team error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/team — upsert a team member (called on login)
export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const { id, orgId, name, title } = await req.json();
    if (!id || !orgId || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // Check if this is the first member of the org — make them admin
    const existing = await sql`SELECT COUNT(*) as count FROM etf_team_members WHERE org_id = ${orgId}`;
    const isFirst = parseInt(existing[0]?.count || "0") === 0;

    await sql`
      INSERT INTO etf_team_members (id, org_id, name, title, is_admin, is_active, last_seen)
      VALUES (${id}, ${orgId}, ${name}, ${title || ""}, ${isFirst}, TRUE, NOW())
      ON CONFLICT (id) DO UPDATE
        SET name = ${name},
            title = ${title || ""},
            last_seen = NOW(),
            is_active = TRUE
    `;

    const member = await sql`SELECT * FROM etf_team_members WHERE id = ${id}`;
    return NextResponse.json(member[0]);
  } catch (error) {
    console.error("POST /api/team error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/team — admin actions (promote, deactivate, change passcode)
export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const { action, memberId, requesterId, orgId, newPasscode } = await req.json();

    // Verify requester is admin
    const requester = await sql`
      SELECT is_admin FROM etf_team_members WHERE id = ${requesterId} AND org_id = ${orgId}
    `;
    if (!requester[0]?.is_admin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (action === "promote") {
      await sql`UPDATE etf_team_members SET is_admin = TRUE WHERE id = ${memberId} AND org_id = ${orgId}`;
    } else if (action === "demote") {
      // Can't demote yourself if you're the only admin
      const admins = await sql`SELECT COUNT(*) as count FROM etf_team_members WHERE org_id = ${orgId} AND is_admin = TRUE`;
      if (parseInt(admins[0]?.count || "0") <= 1 && memberId === requesterId) {
        return NextResponse.json({ error: "Cannot remove the only admin" }, { status: 400 });
      }
      await sql`UPDATE etf_team_members SET is_admin = FALSE WHERE id = ${memberId} AND org_id = ${orgId}`;
    } else if (action === "deactivate") {
      await sql`UPDATE etf_team_members SET is_active = FALSE WHERE id = ${memberId} AND org_id = ${orgId}`;
    } else if (action === "reactivate") {
      await sql`UPDATE etf_team_members SET is_active = TRUE WHERE id = ${memberId} AND org_id = ${orgId}`;
    } else if (action === "change_passcode") {
      if (!newPasscode || newPasscode.length < 4) {
        return NextResponse.json({ error: "Passcode must be at least 4 characters" }, { status: 400 });
      }
      await sql`UPDATE etf_orgs SET passcode = ${newPasscode} WHERE id = ${orgId}`;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/team error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}