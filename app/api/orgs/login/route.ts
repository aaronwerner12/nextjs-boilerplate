import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: NextRequest) {
  try {
    const { passcode } = await req.json();

    if (!passcode) {
      return NextResponse.json({ error: "Passcode required" }, { status: 400 });
    }

    // Look up org by passcode
    const rows = await sql`
      SELECT id, name, city, state, notify_email
      FROM etf_orgs
      WHERE passcode = ${passcode}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
    }

    const org = rows[0];

    // Also fetch venues
    const venues = await sql`
      SELECT name, address FROM etf_venues
      WHERE org_id = ${org.id}
      ORDER BY sort_order, name
    `;

    return NextResponse.json({
      id: org.id,
      name: org.name,
      city: org.city,
      state: org.state,
      notifyEmail: org.notify_email,
      logoUrl: org.logo_url || "",
      venues,
    });
  } catch (error) {
    console.error("POST /api/orgs/login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
