import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dtexas2025";

export async function GET(req: NextRequest) {
  try {
    // Simple password check via header or query param
    const { searchParams } = new URL(req.url);
    const pwd = searchParams.get("pwd") || req.headers.get("x-admin-pwd");

    if (pwd !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Orgs summary
    const orgs = await sql`
      SELECT 
        id,
        name,
        city,
        state,
        created_at
      FROM etf_orgs
      ORDER BY created_at DESC
    `.catch(() => []);

    // Event counts per org
    const eventCounts = await sql`
      SELECT 
        org_id,
        COUNT(*) as total_events,
        COUNT(CASE WHEN data->>'status' = 'complete' THEN 1 END) as completed,
        COUNT(CASE WHEN data->>'status' = 'application' THEN 1 END) as in_application,
        COUNT(CASE WHEN data->>'status' = 'analysis' THEN 1 END) as in_analysis,
        MAX(updated_at) as last_active
      FROM etf_events
      GROUP BY org_id
    `.catch(() => []);

    // Member counts per org
    const memberCounts = await sql`
      SELECT org_id, COUNT(*) as member_count
      FROM etf_team
      GROUP BY org_id
    `.catch(() => []);

    // Intake submissions
    const intakeStats = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'promoted' THEN 1 END) as promoted,
        COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed
      FROM etf_intake
    `.catch(() => [{ total: 0, pending: 0, promoted: 0, dismissed: 0 }]);

    // Total events
    const totalEvents = await sql`
      SELECT COUNT(*) as count FROM etf_events
    `.catch(() => [{ count: 0 }]);

    // Merge org data with event counts
    const orgsWithStats = orgs.map((org) => {
      const stats = eventCounts.find((e) => e.org_id === org.id);
      const members = memberCounts.find((m) => m.org_id === org.id);
      return {
        id: org.id,
        name: org.name,
        city: org.city,
        state: org.state,
        joinedAt: org.created_at,
        totalEvents: parseInt(stats?.total_events || "0"),
        completed: parseInt(stats?.completed || "0"),
        inApplication: parseInt(stats?.in_application || "0"),
        inAnalysis: parseInt(stats?.in_analysis || "0"),
        lastActive: stats?.last_active || null,
        memberCount: parseInt(members?.member_count || "0"),
      };
    });

    return NextResponse.json({
      summary: {
        totalOrgs: orgs.length,
        totalEvents: parseInt(totalEvents[0]?.count || "0"),
        intake: intakeStats[0],
      },
      orgs: orgsWithStats,
    });
  } catch (error) {
    console.error("GET /api/admin error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
