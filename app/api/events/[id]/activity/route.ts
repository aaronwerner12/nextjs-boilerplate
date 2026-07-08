import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { ensureActivityTable } from "../../activity-lib";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/events/[id]/activity?org_id=xxx — change history, newest first
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureActivityTable();
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id");
    if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

    const rows = await sql`
      SELECT member_name, summary, created_at
      FROM etf_event_activity
      WHERE event_id = ${params.id} AND org_id = ${orgId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/events/[id]/activity error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
