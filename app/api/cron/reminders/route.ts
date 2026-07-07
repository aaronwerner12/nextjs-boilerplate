import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sql = neon(process.env.DATABASE_URL!);

// Mirrors the TIMELINE constant in ETFPlaybook.tsx — offsets in days
// relative to the event's first day (negative) or last day (positive).
const DEADLINES = [
  { key: "application", label: "Submit Application Packet", offset: -120, fromLastDay: false, critical: true },
  { key: "supportContract", label: "Event Support Contract Submitted", offset: -1, fromLastDay: false, critical: true },
  { key: "attendanceCert", label: "Attendance Certification Due", offset: 45, fromLastDay: true, critical: true },
  { key: "localShare", label: "Local Share Deposit Due (2pm CST)", offset: 90, fromLastDay: true, critical: true },
  { key: "disbursement", label: "Disbursement Request Due", offset: 180, fromLastDay: true, critical: true },
];

function addDays(dateStr: string, days: number): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export async function GET(req: NextRequest) {
  try {
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when the env var is set
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
    }

    const orgs = await sql`
      SELECT id, name, notify_email FROM etf_orgs
      WHERE notify_email IS NOT NULL AND notify_email != ''
    `;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 45 * 86400000);
    const windowStart = new Date(now.getTime() - 7 * 86400000);
    const results: Array<{ org: string; sent: boolean; deadlines: number }> = [];

    for (const org of orgs) {
      const events = await sql`
        SELECT data FROM etf_events WHERE org_id = ${org.id}
      `;

      const upcoming: Array<{ eventName: string; label: string; due: Date; daysAway: number }> = [];
      for (const row of events) {
        const e = row.data as any;
        if (!e?.firstDay || e.status === "complete") continue;
        for (const dl of DEADLINES) {
          const anchor = dl.fromLastDay ? (e.lastDay || e.firstDay) : e.firstDay;
          const due = addDays(anchor, dl.offset);
          if (!due || due < windowStart || due > windowEnd) continue;
          const daysAway = Math.ceil((due.getTime() - now.getTime()) / 86400000);
          upcoming.push({ eventName: e.name || "Untitled event", label: dl.label, due, daysAway });
        }
      }

      if (upcoming.length === 0) {
        results.push({ org: org.name, sent: false, deadlines: 0 });
        continue;
      }

      upcoming.sort((a, b) => a.due.getTime() - b.due.getTime());

      const rows = upcoming.map((d) => {
        const status = d.daysAway < 0
          ? `<span style="color:#dc2626;font-weight:700">${Math.abs(d.daysAway)} days OVERDUE</span>`
          : d.daysAway <= 14
            ? `<span style="color:#B04E31;font-weight:700">in ${d.daysAway} days</span>`
            : `in ${d.daysAway} days`;
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #DFDDD0;font-size:14px">${status}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #DFDDD0;font-size:14px"><strong>${d.label}</strong><br><span style="color:#6C7065;font-size:13px">${d.eventName}</span></td>
          <td style="padding:8px 12px;border-bottom:1px solid #DFDDD0;font-size:13px;color:#6C7065;white-space:nowrap">${fmtDate(d.due)}</td>
        </tr>`;
      }).join("");

      const html = `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#F1EFE6;border-radius:12px">
  <h2 style="color:#1E4536;margin:0 0 4px">ETF Deadline Digest</h2>
  <p style="color:#6C7065;font-size:14px;margin:0 0 20px">${org.name} — ${upcoming.length} deadline${upcoming.length === 1 ? "" : "s"} in the next 45 days</p>
  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden">
    ${rows}
  </table>
  <p style="color:#979A8D;font-size:12px;margin-top:20px">Sent weekly by your ETF Analysis Tool. Deadlines are computed from Texas Event Trust Fund Guidelines. Not affiliated with the Office of the Governor or EDT.</p>
</div>`;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ETF Analysis Tool <onboarding@resend.dev>",
          to: [org.notify_email],
          subject: `ETF deadlines: ${upcoming.length} coming up${upcoming.some(d => d.daysAway < 0) ? " (some OVERDUE)" : ""} — ${org.name}`,
          html,
        }),
      });

      results.push({ org: org.name, sent: emailRes.ok, deadlines: upcoming.length });
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("GET /api/cron/reminders error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
