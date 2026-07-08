import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_presence (
      event_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      seen_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (event_id, member_id)
    )
  `.catch(() => {});
}

// POST /api/presence { eventId, memberId, memberName } — heartbeat while
// viewing an event. Returns everyone ELSE active on it in the last 90s.
export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const { eventId, memberId, memberName } = await req.json();
    if (!eventId || !memberId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await sql`
      INSERT INTO etf_presence (event_id, member_id, member_name, seen_at)
      VALUES (${eventId}, ${memberId}, ${memberName || "Someone"}, NOW())
      ON CONFLICT (event_id, member_id) DO UPDATE
        SET seen_at = NOW(), member_name = ${memberName || "Someone"}
    `;

    const others = await sql`
      SELECT member_name FROM etf_presence
      WHERE event_id = ${eventId}
        AND member_id != ${memberId}
        AND seen_at > NOW() - INTERVAL '90 seconds'
    `;

    // Opportunistic cleanup of stale rows
    await sql`DELETE FROM etf_presence WHERE seen_at < NOW() - INTERVAL '1 hour'`.catch(() => {});

    return NextResponse.json({ others: others.map((o) => o.member_name) });
  } catch (error) {
    console.error("POST /api/presence error:", error);
    return NextResponse.json({ others: [] });
  }
}
