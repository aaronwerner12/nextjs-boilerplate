import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { buildPulseHtml } from "../email-templates";
import { logCronRun } from "../run-log";
import { EMAIL_FROM, REPLY_TO } from "../../email-from";
import { getOptedOut, unsubscribeUrl } from "../../unsubscribe-lib";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sql = neon(process.env.DATABASE_URL!);

// Monthly "pulse" email. Unlike the deadline digest (which stays silent
// when nothing is due), this always sends — the point is to keep the tool
// from being out-of-sight-out-of-mind between event cycles.
export async function GET(req: NextRequest) {
  try {
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET>. An admin can
    // also trigger a run on demand with the admin password header.
    const cronSecret = process.env.CRON_SECRET;
    const adminPwd = process.env.ADMIN_PASSWORD;
    const isAdmin = !!adminPwd && req.headers.get("x-admin-pwd") === adminPwd;
    if (cronSecret && !isAdmin) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://etfplaybook.vercel.app";

    const orgs = await sql`SELECT id, name, notify_email, contact_email FROM etf_orgs`;

    const optedOut = await getOptedOut();
    const now = new Date();
    const results: Array<{ org: string; sent: boolean }> = [];

    for (const org of orgs) {
      const events = await sql`
        SELECT data, updated_at FROM etf_events WHERE org_id = ${org.id}
      `;

      let active = 0;
      let stale = 0;
      let noDates = 0;
      let lastTouched: Date | null = null;
      for (const row of events) {
        const e = row.data as any;
        if (e?.status !== "complete") active++;
        if (!e?.firstDay) noDates++;
        const upd = new Date(row.updated_at);
        if (!lastTouched || upd > lastTouched) lastTouched = upd;
        if (e?.status !== "complete" && now.getTime() - upd.getTime() > 30 * 86400000) stale++;
      }

      const daysSinceActivity = lastTouched
        ? Math.floor((now.getTime() - lastTouched.getTime()) / 86400000)
        : null;

      // Pick the nudge that fits where this org actually is
      let nudge: string;
      if (events.length === 0) {
        nudge = `You haven't analyzed an event yet. The next time a tournament, championship, or convention considers your city, run it through the eligibility check — it takes about five minutes and tells you whether a six-figure state reimbursement is on the table.`;
      } else if (stale > 0) {
        nudge = `${stale} active event${stale === 1 ? " hasn't" : "s haven't"} been touched in over 30 days. A quick status update keeps your deadline tracking accurate — and if an event fell through, marking it keeps your pipeline numbers honest.`;
      } else if (noDates > 0) {
        nudge = `${noDates} of your events ${noDates === 1 ? "is" : "are"} missing dates. Adding dates unlocks the automatic deadline timeline, including the critical 120-day application window.`;
      } else {
        nudge = `Heard about a new event considering your area? Even a rough analysis with estimated attendance tells you whether it's worth pursuing ETF funding — before you commit staff time.`;
      }

      // Send to the org's notification + contact emails plus every active
      // team member who has added an email
      const members = await sql`
        SELECT email FROM etf_team_members
        WHERE org_id = ${org.id} AND is_active = TRUE
          AND email IS NOT NULL AND email != ''
      `.catch(() => []);
      const recipients = Array.from(new Set(
        [org.notify_email, org.contact_email, ...members.map((m) => m.email)]
          .map((e) => (e || "").trim().toLowerCase())
          .filter((e) => e.includes("@"))
      )).filter((e) => !optedOut.has(e));
      if (recipients.length === 0) {
        results.push({ org: org.name, sent: false });
        continue;
      }

      const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const subject = `${org.name}: your ETF pipeline check-in — ${events.length} event${events.length === 1 ? "" : "s"} tracked`;

      // Send individually so each recipient gets their own unsubscribe link
      let anySent = false;
      for (const rcpt of recipients) {
        const html = buildPulseHtml(
          org.name,
          { totalEvents: events.length, active, daysSinceActivity, nudge },
          appUrl,
          monthLabel,
          unsubscribeUrl(rcpt, appUrl)
        );
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: EMAIL_FROM, ...(REPLY_TO ? { reply_to: REPLY_TO } : {}), to: [rcpt], subject, html }),
        }).catch(() => null);
        if (r && r.ok) anySent = true;
      }

      results.push({ org: org.name, sent: anySent });
    }

    const sentCount = results.filter((r) => r.sent).length;
    await logCronRun("engagement", results.length, sentCount,
      `${sentCount}/${results.length} orgs emailed`).catch(() => {});

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("GET /api/cron/engagement error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
