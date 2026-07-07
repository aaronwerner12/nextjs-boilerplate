import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/share?token=xxx — public, read-only view of a shared event.
// Only returns analysis data; internal notes and outcome figures are stripped.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token || token.length < 16) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const rows = await sql`
      SELECT e.data, e.org_id, o.name as org_name, o.city as org_city, o.state as org_state
      FROM etf_events e
      LEFT JOIN etf_orgs o ON o.id = e.org_id
      WHERE e.data->>'shareToken' = ${token}
      LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const e = rows[0].data as any;
    return NextResponse.json({
      orgName: rows[0].org_name,
      orgCity: rows[0].org_city,
      orgState: rows[0].org_state,
      event: {
        name: e.name,
        firstDay: e.firstDay,
        lastDay: e.lastDay,
        venues: e.venues,
        venue: e.venue,
        status: e.status,
        siteSelectionOrg: e.siteSelectionOrg,
        elig: e.elig,
        attendeeEst: e.attendeeEst,
        qualityPerAttendee: e.qualityPerAttendee,
        roomNights: e.roomNights,
        outOfMarketPct: e.outOfMarketPct,
        calc: e.calc,
      },
    });
  } catch (error) {
    console.error("GET /api/share error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
