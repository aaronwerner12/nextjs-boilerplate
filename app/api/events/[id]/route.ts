import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

// DELETE /api/events/[id]?org_id=xxx — soft delete: the event moves to
// the trash and is purged for real after 30 days.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id");

    if (!orgId) {
      return NextResponse.json({ error: "org_id required" }, { status: 400 });
    }

    await sql`ALTER TABLE etf_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`.catch(() => {});

    // Only trash if the event belongs to the requesting org
    await sql`
      UPDATE etf_events SET deleted_at = NOW()
      WHERE id = ${id} AND org_id = ${orgId}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/events/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}

// PATCH /api/events/[id] { action: "restore", orgId } — bring an event
// back from the trash.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { action, orgId } = await req.json();

    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }
    if (action !== "restore") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    await sql`
      UPDATE etf_events SET deleted_at = NULL, updated_at = NOW()
      WHERE id = ${id} AND org_id = ${orgId}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/events/[id] error:", error);
    return NextResponse.json({ error: "Failed to restore event" }, { status: 500 });
  }
}
